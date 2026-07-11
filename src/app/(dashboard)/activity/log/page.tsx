"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  List,
  Plus,
  Square,
  Trash2,
  TrendingUp,
  Trophy,
  X,
  MessageSquare,
  Gauge,
  Flame,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { exercises as exerciseCatalog, type ExerciseDefinition } from "@/data/exercises"
import { ExercisePicker } from "@/components/activity/exercise-picker"
import { RestTimer } from "@/components/activity/rest-timer"
import { PreviousPerformance } from "@/components/activity/PreviousPerformance"
import { OverloadSuggestion } from "@/components/activity/OverloadSuggestion"
import { useExerciseHistory } from "@/hooks/useExerciseHistory"
import { isNewPersonalRecord } from "@/lib/personal-records"
import {
  estimateStrengthCalories,
  estimateCardioCalories,
  type CalorieProfile,
} from "@/lib/calories"
import { ensureExercisesExist } from "@/lib/supabase/exercises"

// ── Types ─────────────────────────────────────────────────────
interface ActiveSet {
  reps: number | null
  weight: number | null
  durationMins: number | null
  distanceMiles: number | null
  speedMph: number | null
  inclinePercent: number | null
  rpe: number | null
  completed: boolean
}

interface ActiveExercise {
  exerciseId: string
  name: string
  muscleGroups: string[]
  exerciseType: "strength" | "cardio" | "flexibility"
  equipmentId: string | null
  /** Prescribed rep range string from the template (e.g. "8-12"). Null for
   *  freestyle workouts. Drives the progressive-overload suggestion. */
  repsTarget: string | null
  sets: ActiveSet[]
  notes: string
  restSeconds: number
}

interface ActiveWorkout {
  name: string
  templateId: string | null
  startedAt: Date
  exercises: ActiveExercise[]
}

// ── Helpers ───────────────────────────────────────────────────
function makeSet(): ActiveSet {
  return {
    reps: null,
    weight: null,
    durationMins: null,
    distanceMiles: null,
    speedMph: null,
    inclinePercent: null,
    rpe: null,
    completed: false,
  }
}

function makeExercise(
  def: ExerciseDefinition,
  restSec: number = 60,
  repsTarget: string | null = null
): ActiveExercise {
  const numSets = def.defaultSets || 3
  return {
    exerciseId: def.id,
    name: def.name,
    muscleGroups: def.muscleGroups,
    exerciseType: def.exerciseType,
    equipmentId: def.equipmentId,
    repsTarget,
    sets: Array.from({ length: numSets }, () => makeSet()),
    notes: "",
    restSeconds: restSec,
  }
}

function isTreadmill(ex: ActiveExercise): boolean {
  return ex.equipmentId === "treadmill"
}

function isOutdoorRun(ex: ActiveExercise): boolean {
  return ex.exerciseId === "outdoor-run"
}

/** Exercises where we compute speed from time + distance instead of taking
 *  it as input. Treadmill (with incline) and outdoor run (with pace). */
function isDistanceCardio(ex: ActiveExercise): boolean {
  return isTreadmill(ex) || isOutdoorRun(ex)
}

/** Average speed (mph) computed from distance + duration. Returns null when
 *  either input is missing or zero. */
function computeSpeedMph(
  distanceMiles: number | null,
  durationMins: number | null
): number | null {
  if (!distanceMiles || !durationMins) return null
  if (distanceMiles <= 0 || durationMins <= 0) return null
  return distanceMiles / (durationMins / 60)
}

/** Format pace as "M:SS /mi" from distance + duration. */
function formatPace(
  distanceMiles: number | null,
  durationMins: number | null
): string {
  if (!distanceMiles || !durationMins) return "—"
  if (distanceMiles <= 0 || durationMins <= 0) return "—"
  const minPerMile = durationMins / distanceMiles
  const mins = Math.floor(minPerMile)
  const secs = Math.round((minPerMile - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatTimer(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hrs > 0)
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// ── Component ─────────────────────────────────────────────────
export default function LogWorkoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get("template")

  const [workout, setWorkout] = useState<ActiveWorkout | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [showPicker, setShowPicker] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showRpe, setShowRpe] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showIncline, setShowIncline] = useState(false)
  const [restTimer, setRestTimer] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [userWeightLbs, setUserWeightLbs] = useState<number>(170)
  const [calorieProfile, setCalorieProfile] = useState<CalorieProfile>({})
  const startRef = useRef<Date | null>(null)
  /** Exercises we've already pre-filled this session, so we don't clobber
   *  user edits if they tab back to the exercise. */
  const prefilledExercises = useRef<Set<string>>(new Set())

  // Load template or start freestyle
  useEffect(() => {
    async function init() {
      if (templateId) {
        const supabase = createClient()
        const { data: template } = await supabase
          .from("workout_templates")
          .select("id, name")
          .eq("id", templateId)
          .single()

        const { data: templateExercises } = await supabase
          .from("template_exercises")
          .select(
            "exercise_id, sets, reps, rest_seconds, order_index, exercises(name)"
          )
          .eq("template_id", templateId)
          .order("order_index", { ascending: true })

        // template_exercises.exercise_id is a DB UUID; map it to the static
        // catalog entry by the exercise name (the two catalogs share names).
        const exDefsByName = new Map(
          exerciseCatalog.map((e) => [e.name, e])
        )
        const activeExercises: ActiveExercise[] = (
          (templateExercises ?? []) as Array<{
            exercise_id: string
            sets: number | null
            reps: string | null
            rest_seconds: number | null
            order_index: number
            exercises: { name: string } | { name: string }[] | null
          }>
        )
          .map((te) => {
            const exRow = Array.isArray(te.exercises)
              ? te.exercises[0]
              : te.exercises
            const name = exRow?.name
            if (!name) return null
            const def = exDefsByName.get(name)
            if (!def) return null
            return {
              exerciseId: def.id,
              name: def.name,
              muscleGroups: def.muscleGroups,
              exerciseType: def.exerciseType,
              equipmentId: def.equipmentId,
              repsTarget: te.reps ?? null,
              sets: Array.from({ length: te.sets || 3 }, () => makeSet()),
              notes: "",
              restSeconds: te.rest_seconds || 60,
            } satisfies ActiveExercise
          })
          .filter(Boolean) as ActiveExercise[]

        const now = new Date()
        startRef.current = now
        setWorkout({
          name: template?.name ?? "Workout",
          templateId: templateId,
          startedAt: now,
          exercises: activeExercises,
        })
      } else {
        const now = new Date()
        startRef.current = now
        setWorkout({
          name: "Freestyle Workout",
          templateId: null,
          startedAt: now,
          exercises: [],
        })
      }
    }
    init()
  }, [templateId])

  // Fetch user weight for calorie calculations
  useEffect(() => {
    async function fetchWeight() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("current_weight, age, sex, height_inches")
        .eq("id", user.id)
        .single()
      if (profile?.current_weight) setUserWeightLbs(profile.current_weight)
      if (profile) {
        setCalorieProfile({
          age: profile.age,
          sex: profile.sex,
          heightInches: profile.height_inches,
        })
      }
    }
    fetchWeight()
  }, [])

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => {
      if (startRef.current) {
        setElapsed(Math.floor((Date.now() - startRef.current.getTime()) / 1000))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Exercise mutations ──────────────────────────────────────
  const updateSet = useCallback(
    (exIdx: number, setIdx: number, patch: Partial<ActiveSet>) => {
      setWorkout((prev) => {
        if (!prev) return prev
        const exercises = [...prev.exercises]
        const ex = { ...exercises[exIdx] }
        const sets = [...ex.sets]
        sets[setIdx] = { ...sets[setIdx], ...patch }
        ex.sets = sets
        exercises[exIdx] = ex
        return { ...prev, exercises }
      })
    },
    []
  )

  const toggleSetComplete = useCallback(
    (exIdx: number, setIdx: number) => {
      setWorkout((prev) => {
        if (!prev) return prev
        const exercises = [...prev.exercises]
        const ex = { ...exercises[exIdx] }
        const sets = [...ex.sets]
        const wasCompleted = sets[setIdx].completed
        sets[setIdx] = { ...sets[setIdx], completed: !wasCompleted }
        ex.sets = sets
        exercises[exIdx] = ex

        // Trigger rest timer when completing a set (not uncompleting)
        if (!wasCompleted) {
          setRestTimer(ex.restSeconds)
        }

        return { ...prev, exercises }
      })
    },
    []
  )

  const addSet = useCallback((exIdx: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const exercises = [...prev.exercises]
      const ex = { ...exercises[exIdx] }
      ex.sets = [...ex.sets, makeSet()]
      exercises[exIdx] = ex
      return { ...prev, exercises }
    })
  }, [])

  const removeSet = useCallback((exIdx: number, setIdx: number) => {
    setWorkout((prev) => {
      if (!prev) return prev
      const exercises = [...prev.exercises]
      const ex = { ...exercises[exIdx] }
      if (ex.sets.length <= 1) return prev
      ex.sets = ex.sets.filter((_, i) => i !== setIdx)
      exercises[exIdx] = ex
      return { ...prev, exercises }
    })
  }, [])

  const updateExerciseNotes = useCallback(
    (exIdx: number, notes: string) => {
      setWorkout((prev) => {
        if (!prev) return prev
        const exercises = [...prev.exercises]
        exercises[exIdx] = { ...exercises[exIdx], notes }
        return { ...prev, exercises }
      })
    },
    []
  )

  const removeExercise = useCallback(
    (exIdx: number) => {
      setWorkout((prev) => {
        if (!prev) return prev
        const exercises = prev.exercises.filter((_, i) => i !== exIdx)
        return { ...prev, exercises }
      })
      setCurrentIdx((prev) => Math.max(0, Math.min(prev, (workout?.exercises.length ?? 1) - 2)))
    },
    [workout?.exercises.length]
  )

  const addExercise = useCallback(
    (def: ExerciseDefinition) => {
      setWorkout((prev) => {
        if (!prev) return prev
        return { ...prev, exercises: [...prev.exercises, makeExercise(def)] }
      })
      setShowPicker(false)
      // Navigate to the newly added exercise
      setCurrentIdx(workout?.exercises.length ?? 0)
    },
    [workout?.exercises.length]
  )

  // ── Calorie estimates ────────────────────────────────────────
  function getExerciseCalories(ex: ActiveExercise): number {
    const completedSets = ex.sets.filter((s) => s.completed)
    if (ex.exerciseType === "cardio") {
      const totalMins = completedSets.reduce(
        (sum, s) => sum + (s.durationMins ?? 0),
        0
      )
      // For distance-based cardio (treadmill / outdoor run), compute speed
      // from distance/duration; otherwise use the manually entered speedMph.
      const speedPerSet = completedSets.map((s) =>
        isDistanceCardio(ex)
          ? computeSpeedMph(s.distanceMiles, s.durationMins)
          : s.speedMph
      )
      const validSpeeds = speedPerSet.filter(
        (v): v is number => v != null && v > 0
      )
      const avgSpeed =
        validSpeeds.length > 0
          ? validSpeeds.reduce((sum, v) => sum + v, 0) / validSpeeds.length
          : null
      // Average incline (treadmill only). Skip null/zero entries so they
      // don't drag the average down for sets where incline wasn't logged.
      const inclines = completedSets
        .map((s) => s.inclinePercent)
        .filter((v): v is number => v != null && v > 0)
      const avgIncline =
        inclines.length > 0
          ? inclines.reduce((sum, v) => sum + v, 0) / inclines.length
          : null
      return estimateCardioCalories(
        ex.exerciseId,
        totalMins,
        userWeightLbs,
        avgSpeed,
        avgIncline,
        calorieProfile
      )
    }
    return estimateStrengthCalories(
      ex.exerciseId,
      completedSets.length,
      userWeightLbs,
      calorieProfile
    )
  }

  const totalCalories = workout
    ? workout.exercises.reduce((sum, ex) => sum + getExerciseCalories(ex), 0)
    : 0

  // ── Save workout ────────────────────────────────────────────
  const finishWorkout = async () => {
    if (!workout || workout.exercises.length === 0) return
    setSaving(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const finishedAt = new Date()
    const durationMins = Math.round(
      (finishedAt.getTime() - workout.startedAt.getTime()) / 60000
    )

    // Insert workout log
    const { data: logRow, error: logErr } = await supabase
      .from("workout_logs")
      .insert({
        user_id: user.id,
        template_id: workout.templateId,
        name: workout.name,
        started_at: workout.startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_mins: durationMins,
      })
      .select("id")
      .single()

    if (logErr || !logRow) {
      setSaving(false)
      return
    }

    // Map static exercise IDs to database UUIDs
    const exerciseIds = workout.exercises.map((ex) => ex.exerciseId)
    const idMap = await ensureExercisesExist(supabase, exerciseIds)

    // Insert exercise logs + set logs
    for (let ei = 0; ei < workout.exercises.length; ei++) {
      const ex = workout.exercises[ei]
      const completedSets = ex.sets.filter((s) => s.completed)
      if (completedSets.length === 0) continue

      const dbExerciseId = idMap.get(ex.exerciseId)
      if (!dbExerciseId) continue

      const { data: exRow } = await supabase
        .from("exercise_logs")
        .insert({
          workout_log_id: logRow.id,
          exercise_id: dbExerciseId,
          order_index: ei,
          notes: ex.notes || null,
        })
        .select("id")
        .single()

      if (!exRow) continue

      const setInserts = completedSets.map((s, si) => ({
        exercise_log_id: exRow.id,
        set_number: si + 1,
        reps: s.reps,
        weight: s.weight,
        duration_mins: s.durationMins,
        distance_miles: s.distanceMiles,
        incline_percent: s.inclinePercent,
        rpe: s.rpe,
      }))

      await supabase.from("set_logs").insert(setInserts)
    }

    router.push(`/activity/${logRow.id}`)
  }

  // ── Derived state + hooks ───────────────────────────────────
  // NOTE: every hook below must run before the `if (!workout)` early return.
  // `workout` starts null and is set by init(); if these hooks lived after
  // the early return they'd be skipped on the first (null) render and then
  // called on the next, changing the hook count and crashing the page with
  // "Rendered more hooks than during the previous render".
  const currentExercise = workout?.exercises[currentIdx]

  // For PR detection during the active workout. Returns the all-time max
  // weight for the current exercise *before* this session.
  const { data: currentHistory } = useExerciseHistory(
    currentExercise?.exerciseId ?? ""
  )
  const allTimeMaxWeight = currentHistory?.allTimeMaxWeight ?? null

  // Pre-fill set weights from the previous session. Runs once per exercise
  // per session, only if every set is still untouched (no weight typed, no
  // reps typed, not completed). Reps are not pre-filled since they vary
  // more than weight session to session.
  useEffect(() => {
    if (!currentExercise) return
    if (currentExercise.exerciseType !== "strength") return
    if (prefilledExercises.current.has(currentExercise.exerciseId)) return
    if (!currentHistory) return
    const prevSets = currentHistory.previousSets
    if (prevSets.length === 0) {
      prefilledExercises.current.add(currentExercise.exerciseId)
      return
    }
    const untouched = currentExercise.sets.every(
      (s) => s.weight == null && s.reps == null && !s.completed
    )
    if (!untouched) {
      prefilledExercises.current.add(currentExercise.exerciseId)
      return
    }
    const exerciseId = currentExercise.exerciseId
    setWorkout((prev) => {
      if (!prev) return prev
      const idx = prev.exercises.findIndex((e) => e.exerciseId === exerciseId)
      if (idx === -1) return prev
      const exercises = [...prev.exercises]
      const ex = { ...exercises[idx] }
      ex.sets = ex.sets.map((s, i) => {
        const prevSet = prevSets[i] ?? prevSets[prevSets.length - 1]
        return prevSet?.weight != null
          ? { ...s, weight: prevSet.weight }
          : s
      })
      exercises[idx] = ex
      return { ...prev, exercises }
    })
    prefilledExercises.current.add(currentExercise.exerciseId)
  }, [currentExercise, currentHistory])

  // ── Render ──────────────────────────────────────────────────
  if (!workout) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
      </div>
    )
  }

  const isCardio = currentExercise?.exerciseType === "cardio"
  const isTreadmillExercise =
    !!currentExercise && isTreadmill(currentExercise)
  const isOutdoorRunExercise =
    !!currentExercise && isOutdoorRun(currentExercise)
  const isDistanceCardioExercise =
    !!currentExercise && isDistanceCardio(currentExercise)

  return (
    <div className="mx-auto max-w-lg">
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-gray-900">
            {workout.name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span className="tabular-nums">{formatTimer(elapsed)}</span>
            </span>
            {totalCalories > 0 && (
              <span className="flex items-center gap-1 text-orange-500">
                <Flame className="h-3.5 w-3.5" />
                <span className="tabular-nums font-medium">{totalCalories}</span>
                <span className="text-xs">cal</span>
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={finishWorkout}
          disabled={saving || workout.exercises.length === 0}
          className="ml-3 shrink-0"
        >
          {saving ? "Saving..." : "Finish"}
        </Button>
      </div>

      {/* Empty state */}
      {workout.exercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Plus className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">
            No exercises yet
          </p>
          <p className="mb-6 mt-1 text-sm text-gray-400">
            Add exercises to start logging your workout.
          </p>
          <Button onClick={() => setShowPicker(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Exercise
          </Button>
        </div>
      ) : (
        <>
          {/* Exercise navigation */}
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <button
              onClick={() => setShowDrawer(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <List className="h-4 w-4" />
              {currentIdx + 1} / {workout.exercises.length}
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setCurrentIdx((i) =>
                  Math.min(workout.exercises.length - 1, i + 1)
                )
              }
              disabled={currentIdx === workout.exercises.length - 1}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Current exercise card */}
          {currentExercise && (
            <Card className="mb-4">
              <CardContent className="p-4">
                {/* Exercise header */}
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {currentExercise.name}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {currentExercise.muscleGroups.map((mg) => (
                        <Badge
                          key={mg}
                          variant="default"
                          className="text-[10px] capitalize"
                        >
                          {mg.replace("_", " ")}
                        </Badge>
                      ))}
                      {getExerciseCalories(currentExercise) > 0 && (
                        <span className="ml-1 flex items-center gap-0.5 text-xs text-orange-500">
                          <Flame className="h-3 w-3" />
                          {getExerciseCalories(currentExercise)} cal
                        </span>
                      )}
                    </div>
                    <PreviousPerformance
                      exerciseId={currentExercise.exerciseId}
                      exerciseType={currentExercise.exerciseType}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExercise(currentIdx)}
                    className="shrink-0 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Progressive overload suggestion (only when there's a
                    rep target and last session cleared it on all sets) */}
                {currentExercise.exerciseType === "strength" && (
                  <OverloadSuggestion
                    exerciseId={currentExercise.exerciseId}
                    repsTarget={currentExercise.repsTarget}
                    muscleGroups={currentExercise.muscleGroups}
                  />
                )}

                {/* Sets table header */}
                <div
                  className={cn(
                    "mb-2 grid items-center gap-2 text-xs font-medium uppercase text-gray-400",
                    isDistanceCardioExercise
                      ? "grid-cols-[2.5rem_1fr_1fr_3.5rem_3rem]"
                      : isCardio
                      ? "grid-cols-[2.5rem_1fr_1fr_1fr_3rem]"
                      : "grid-cols-[2.5rem_1fr_1fr_3rem]"
                  )}
                >
                  <span className="text-center">Set</span>
                  {isDistanceCardioExercise ? (
                    <>
                      <span>Time</span>
                      <span>Dist</span>
                      <span className="text-center text-[10px] tracking-tight">
                        {isOutdoorRunExercise ? "Pace" : "Avg mph"}
                      </span>
                    </>
                  ) : isCardio ? (
                    <>
                      <span>Time</span>
                      <span>Dist</span>
                      <span>Speed</span>
                    </>
                  ) : (
                    <>
                      <span>Weight</span>
                      <span>Reps</span>
                    </>
                  )}
                  <span className="text-center">
                    <Check className="mx-auto h-3.5 w-3.5" />
                  </span>
                </div>

                {/* Set rows */}
                {currentExercise.sets.map((set, si) => {
                  // PR = strictly heavier than the all-time max AND
                  // heavier than any earlier completed set this session.
                  const earlierMaxThisSession = currentExercise.sets
                    .slice(0, si)
                    .filter((s) => s.completed && s.weight != null)
                    .reduce(
                      (m, s) => (s.weight! > m ? s.weight! : m),
                      0
                    )
                  const threshold = Math.max(
                    allTimeMaxWeight ?? 0,
                    earlierMaxThisSession
                  )
                  const isPR =
                    !isCardio &&
                    set.completed &&
                    isNewPersonalRecord(
                      { weight: set.weight, reps: set.reps },
                      threshold > 0 ? threshold : null
                    )

                  return (
                  <div
                    key={si}
                    className={cn(
                      "mb-1.5 grid items-center gap-2 rounded-lg px-1 py-1.5 transition-colors",
                      isDistanceCardioExercise
                        ? "grid-cols-[2.5rem_1fr_1fr_3.5rem_3rem]"
                        : isCardio
                        ? "grid-cols-[2.5rem_1fr_1fr_1fr_3rem]"
                        : "grid-cols-[2.5rem_1fr_1fr_3rem]",
                      set.completed && "bg-purple-50",
                      isPR && "ring-1 ring-amber-300 bg-amber-50"
                    )}
                  >
                    {/* Set number (with PR badge when applicable) */}
                    <span
                      className={cn(
                        "relative text-center text-sm font-semibold",
                        isPR ? "text-amber-600" : "text-gray-500"
                      )}
                      title={isPR ? "New personal record!" : undefined}
                    >
                      {si + 1}
                      {isPR && (
                        <Trophy className="absolute -right-1 -top-1 h-3 w-3 text-amber-500" />
                      )}
                    </span>

                    {isDistanceCardioExercise ? (
                      <>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="min"
                          value={set.durationMins ?? ""}
                          onChange={(e) =>
                            updateSet(currentIdx, si, {
                              durationMins: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-10 text-center text-sm"
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="mi"
                          value={set.distanceMiles ?? ""}
                          onChange={(e) =>
                            updateSet(currentIdx, si, {
                              distanceMiles: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-10 text-center text-sm"
                        />
                        <span className="flex h-10 items-center justify-center rounded-md bg-gray-50 text-center text-sm tabular-nums text-gray-600">
                          {isOutdoorRunExercise
                            ? formatPace(set.distanceMiles, set.durationMins)
                            : (() => {
                                const speed = computeSpeedMph(
                                  set.distanceMiles,
                                  set.durationMins
                                )
                                return speed != null ? speed.toFixed(1) : "—"
                              })()}
                        </span>
                      </>
                    ) : isCardio ? (
                      <>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="min"
                          value={set.durationMins ?? ""}
                          onChange={(e) =>
                            updateSet(currentIdx, si, {
                              durationMins: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-10 text-center text-sm"
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="mi"
                          value={set.distanceMiles ?? ""}
                          onChange={(e) =>
                            updateSet(currentIdx, si, {
                              distanceMiles: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-10 text-center text-sm"
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="mph"
                          value={set.speedMph ?? ""}
                          onChange={(e) =>
                            updateSet(currentIdx, si, {
                              speedMph: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-10 text-center text-sm"
                        />
                      </>
                    ) : (
                      <>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="lbs"
                          value={set.weight ?? ""}
                          onChange={(e) =>
                            updateSet(currentIdx, si, {
                              weight: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-10 text-center text-base"
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="reps"
                          value={set.reps ?? ""}
                          onChange={(e) =>
                            updateSet(currentIdx, si, {
                              reps: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-10 text-center text-base"
                        />
                      </>
                    )}

                    {/* Complete / uncomplete */}
                    <button
                      onClick={() => toggleSetComplete(currentIdx, si)}
                      className={cn(
                        "mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                        set.completed
                          ? "bg-purple-600 text-white"
                          : "border border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-500"
                      )}
                    >
                      {set.completed ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  )
                })}

                {/* Add set / remove set */}
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addSet(currentIdx)}
                    className="gap-1 text-purple-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Set
                  </Button>
                  {currentExercise.sets.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        removeSet(currentIdx, currentExercise.sets.length - 1)
                      }
                      className="gap-1 text-gray-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove Last
                    </Button>
                  )}
                </div>

                {/* Incline (treadmill only, collapsible) */}
                {isTreadmillExercise && (
                  <>
                    <button
                      onClick={() => setShowIncline((v) => !v)}
                      className="mt-3 flex w-full items-center gap-1.5 border-t border-gray-100 pt-3 text-sm text-gray-500 hover:text-gray-700"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Incline (optional)
                      {showIncline ? (
                        <ChevronUp className="ml-auto h-4 w-4" />
                      ) : (
                        <ChevronDown className="ml-auto h-4 w-4" />
                      )}
                    </button>
                    {showIncline && (
                      <div className="mt-2 space-y-1.5">
                        {currentExercise.sets.map((set, si) => (
                          <div key={si} className="flex items-center gap-2">
                            <span className="w-10 text-center text-xs text-gray-400">
                              Set {si + 1}
                            </span>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min={0}
                              max={30}
                              placeholder="%"
                              value={set.inclinePercent ?? ""}
                              onChange={(e) =>
                                updateSet(currentIdx, si, {
                                  inclinePercent: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                })
                              }
                              className="h-8 max-w-[5rem] text-center text-sm"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* RPE selector (collapsible) */}
                <button
                  onClick={() => setShowRpe((v) => !v)}
                  className="mt-3 flex w-full items-center gap-1.5 border-t border-gray-100 pt-3 text-sm text-gray-500 hover:text-gray-700"
                >
                  <Gauge className="h-4 w-4" />
                  RPE (effort)
                  {showRpe ? (
                    <ChevronUp className="ml-auto h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-auto h-4 w-4" />
                  )}
                </button>
                {showRpe && (
                  <div className="mt-2 space-y-1.5">
                    {currentExercise.sets.map((set, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <span className="w-10 text-center text-xs text-gray-400">
                          Set {si + 1}
                        </span>
                        <div className="flex flex-1 gap-1">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                            <button
                              key={v}
                              onClick={() =>
                                updateSet(currentIdx, si, { rpe: v })
                              }
                              className={cn(
                                "flex h-7 flex-1 items-center justify-center rounded text-xs font-medium transition-colors",
                                set.rpe === v
                                  ? "bg-purple-600 text-white"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              )}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes (collapsible) */}
                <button
                  onClick={() => setShowNotes((v) => !v)}
                  className="mt-3 flex w-full items-center gap-1.5 border-t border-gray-100 pt-3 text-sm text-gray-500 hover:text-gray-700"
                >
                  <MessageSquare className="h-4 w-4" />
                  Notes
                  {showNotes ? (
                    <ChevronUp className="ml-auto h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-auto h-4 w-4" />
                  )}
                </button>
                {showNotes && (
                  <textarea
                    value={currentExercise.notes}
                    onChange={(e) =>
                      updateExerciseNotes(currentIdx, e.target.value)
                    }
                    placeholder="Add notes for this exercise..."
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={2}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Add exercise button */}
          <Button
            variant="secondary"
            onClick={() => setShowPicker(true)}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Exercise
          </Button>
        </>
      )}

      {/* Exercise list drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDrawer(false)}
          />
          <div className="relative mt-auto max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white pb-8">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
              <h3 className="font-semibold text-gray-900">Exercises</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDrawer(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <ul className="divide-y divide-gray-50">
              {workout.exercises.map((ex, ei) => {
                const completedSets = ex.sets.filter((s) => s.completed).length
                const totalSets = ex.sets.length
                const allDone = completedSets === totalSets && totalSets > 0

                return (
                  <li key={ei}>
                    <button
                      onClick={() => {
                        setCurrentIdx(ei)
                        setShowDrawer(false)
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-gray-50",
                        ei === currentIdx && "bg-purple-50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                          allDone
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {allDone ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          ei + 1
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {ex.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{completedSets}/{totalSets} sets</span>
                          {getExerciseCalories(ex) > 0 && (
                            <span className="flex items-center gap-0.5 text-orange-400">
                              <Flame className="h-3 w-3" />
                              {getExerciseCalories(ex)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Exercise picker modal */}
      {showPicker && (
        <ExercisePicker
          onSelect={addExercise}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Rest timer */}
      {restTimer !== null && (
        <RestTimer
          seconds={restTimer}
          onComplete={() => {
            setRestTimer(null)
            // Auto-advance: if the current exercise is fully complete and
            // there's a next one, jump to it. Only on natural timer end
            // (not on skip — user may have skipped to do another set).
            const ex = workout?.exercises[currentIdx]
            if (
              ex &&
              ex.sets.length > 0 &&
              ex.sets.every((s) => s.completed) &&
              workout &&
              currentIdx < workout.exercises.length - 1
            ) {
              setCurrentIdx(currentIdx + 1)
            }
          }}
          onSkip={() => setRestTimer(null)}
        />
      )}
    </div>
  )
}
