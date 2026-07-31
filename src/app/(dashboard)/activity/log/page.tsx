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
  MessageSquare,
  Gauge,
  Flame,
  Repeat,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { exercises as exerciseCatalog, type ExerciseDefinition } from "@/data/exercises"
import { ExercisePicker } from "@/components/activity/exercise-picker"
import { RestTimer } from "@/components/activity/rest-timer"
import { HoldTimer } from "@/components/activity/hold-timer"
import { PreviousPerformance } from "@/components/activity/PreviousPerformance"
import { AdaptiveTargetBanner } from "@/components/activity/AdaptiveTargetBanner"
import { ExerciseInfo } from "@/components/activity/ExerciseInfo"
import { ExerciseDrawer } from "@/components/activity/ExerciseDrawer"
import { UncheckedExercisesDialog } from "@/components/activity/UncheckedExercisesDialog"
import { adaptiveTarget } from "@/lib/adaptive-target"
import { suggestedIncrement } from "@/lib/progressive-overload"
import { useExerciseHistory } from "@/hooks/useExerciseHistory"
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds"
import { isNewPersonalRecord, isNewAssistedRecord } from "@/lib/personal-records"
import { type CalorieProfile } from "@/lib/calories"
import { exerciseCalories, workoutCalories } from "@/lib/workout-calories"
import {
  plannedToActive,
  remainingPlannedExercises,
  templateRowsToActive,
  loggedExerciseNames,
  type TemplateExerciseRow,
} from "@/lib/workout-init"
import { formatMuscleGroup } from "@/lib/muscle-groups"
import { saveWorkout } from "@/lib/save-workout"
import {
  buildWorkoutPayload,
  uncheckedExercises,
  isOfflineError,
  saveErrorMessage,
} from "@/lib/finish-workout"
import { addPending, localStorageQueue } from "@/lib/pending-workouts"
import { plannedSession } from "@/lib/todays-workout"
import { isTimedTarget, repsTargetLabel } from "@/lib/reps-target"
import { isBodyweightLoad } from "@/lib/load-type"
import {
  isTreadmill,
  isOutdoorRun,
  isDistanceCardio,
  computeSpeedMph,
  formatPace,
  formatTimer,
  type ActiveSet,
  type ActiveExercise,
  type ActiveWorkout,
} from "@/lib/active-workout"
import * as edits from "@/lib/workout-edits"

// ── Component ─────────────────────────────────────────────────
export default function LogWorkoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get("template")
  // "?plan=today" pre-loads the day's prescribed session from the training plan.
  const planParam = searchParams.get("plan")
  // "?append=<workoutLogId>" adds exercises to an already-saved workout instead
  // of creating a new one (e.g. logging sets you forgot to check off).
  const appendId = searchParams.get("append")

  const [workout, setWorkout] = useState<ActiveWorkout | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  /** When this sitting's clock started. For an appended workout this is the
   *  moment of resuming, NOT the original session's started_at — the header
   *  timer counts the current sitting. */
  const [timerStart, setTimerStart] = useState<Date | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  // When set, the exercise picker replaces the exercise at this index (a
  // "swap" for a broken machine) instead of appending a new one.
  const [swappingIdx, setSwappingIdx] = useState<number | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showRpe, setShowRpe] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showIncline, setShowIncline] = useState(false)
  const [restTimer, setRestTimer] = useState<number | null>(null)
  // Index of the set currently being timed with the hold stopwatch, or null.
  const [holdTimerSet, setHoldTimerSet] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  // Set when Finish is tapped while some exercises have no checked sets — those
  // won't be saved, so confirm before dropping them silently.
  const [pendingFinish, setPendingFinish] = useState(false)
  const [userWeightLbs, setUserWeightLbs] = useState<number>(170)
  const [calorieProfile, setCalorieProfile] = useState<CalorieProfile>({})
  /** When appending to a saved workout: its id and how many exercises it
   *  already has (so new order_index values continue after them). */
  const appendInfo = useRef<{ logId: string; orderOffset: number } | null>(null)
  /** Exercises we've already pre-filled this session, so we don't clobber
   *  user edits if they tab back to the exercise. */
  const prefilledExercises = useRef<Set<string>>(new Set())

  const elapsed = useElapsedSeconds(timerStart)

  // Load template or start freestyle
  useEffect(() => {
    async function init() {
      if (appendId) {
        // Add exercises to an existing saved workout. finishWorkout() inserts
        // into that workout instead of creating a new one. When the workout is
        // a plan session, pre-load the plan's remaining exercises (the ones not
        // already logged) so the user just fills in weights.
        const supabase = createClient()
        const { data: log } = await supabase
          .from("workout_logs")
          .select("id, name, started_at")
          .eq("id", appendId)
          .single()

        if (!log) {
          router.push("/activity")
          return
        }

        // Names already logged in this workout (join exercises(name)).
        const { data: existingRows } = await supabase
          .from("exercise_logs")
          .select("id, exercises(name)")
          .eq("workout_log_id", appendId)
        const existing = (existingRows ?? []) as Array<{
          id: string
          exercises: { name: string } | { name: string }[] | null
        }>

        // If this workout matches the plan session for its day, pre-load the
        // still-missing prescribed exercises; otherwise start empty.
        const planned = plannedSession(new Date(log.started_at))
        const preloaded =
          planned.name === log.name
            ? remainingPlannedExercises(
                planned.exercises,
                loggedExerciseNames(existing),
                exerciseCatalog
              )
            : []

        appendInfo.current = { logId: appendId, orderOffset: existing.length }
        const now = new Date()
        setTimerStart(now)
        setWorkout({
          name: log.name,
          templateId: null,
          startedAt: new Date(log.started_at),
          exercises: preloaded,
        })
        return
      }

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

        const activeExercises = templateRowsToActive(
          (templateExercises ?? []) as TemplateExerciseRow[],
          exerciseCatalog
        )

        const now = new Date()
        setTimerStart(now)
        setWorkout({
          name: template?.name ?? "Workout",
          templateId: templateId,
          startedAt: now,
          exercises: activeExercises,
        })
      } else if (planParam === "today") {
        // Pre-load today's prescribed session (lifts + Zone 2 finisher) from
        // the training plan — no DB round-trip, exercises come from the static
        // catalog so previous-performance + progressive-overload work as usual.
        const planned = plannedSession(new Date())
        const activeExercises = plannedToActive(planned.exercises, exerciseCatalog)

        const now = new Date()
        setTimerStart(now)
        setWorkout({
          name: planned.name,
          templateId: null,
          startedAt: now,
          exercises: activeExercises,
        })
      } else {
        const now = new Date()
        setTimerStart(now)
        setWorkout({
          name: "Freestyle Workout",
          templateId: null,
          startedAt: now,
          exercises: [],
        })
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, planParam, appendId])

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

  // ── Exercise mutations ──────────────────────────────────────
  // The transforms themselves live in lib/workout-edits.ts (pure + tested);
  // these wrappers only thread them through React state.
  const updateSet = useCallback(
    (exIdx: number, setIdx: number, patch: Partial<ActiveSet>) => {
      setWorkout((prev) => (prev ? edits.updateSet(prev, exIdx, setIdx, patch) : prev))
    },
    []
  )

  const toggleSetComplete = useCallback(
    (exIdx: number, setIdx: number) => {
      if (!workout) return
      // Derive from current state rather than from inside the updater: React
      // does not run a functional update synchronously, and it may run it more
      // than once, so arming the rest timer in there was both mistimed and
      // liable to fire twice.
      const { workout: next, restSeconds } = edits.toggleSetComplete(
        workout,
        exIdx,
        setIdx
      )
      setWorkout(next)
      if (restSeconds !== null) setRestTimer(restSeconds)
    },
    [workout]
  )

  const addSet = useCallback((exIdx: number) => {
    setWorkout((prev) => (prev ? edits.addSet(prev, exIdx) : prev))
  }, [])

  const removeSet = useCallback((exIdx: number, setIdx: number) => {
    setWorkout((prev) => (prev ? edits.removeSet(prev, exIdx, setIdx) : prev))
  }, [])

  const updateExerciseNotes = useCallback((exIdx: number, notes: string) => {
    setWorkout((prev) => (prev ? edits.updateExerciseNotes(prev, exIdx, notes) : prev))
  }, [])

  const removeExercise = useCallback(
    (exIdx: number) => {
      const lengthBefore = workout?.exercises.length ?? 0
      setWorkout((prev) => (prev ? edits.removeExercise(prev, exIdx) : prev))
      setCurrentIdx((prev) =>
        edits.clampIndexAfterRemoval(prev, exIdx, lengthBefore)
      )
    },
    [workout?.exercises.length]
  )

  const addExercise = useCallback(
    (def: ExerciseDefinition) => {
      setWorkout((prev) => (prev ? edits.addExercise(prev, def) : prev))
      setShowPicker(false)
      // Navigate to the newly added exercise
      setCurrentIdx(workout?.exercises.length ?? 0)
    },
    [workout?.exercises.length]
  )

  /** Replace one exercise with a substitute (e.g. a broken machine), keeping
   *  the prescribed sets/reps/rest and any sets already entered. */
  const swapExercise = useCallback(
    (idx: number, def: ExerciseDefinition) => {
      setWorkout((prev) => (prev ? edits.swapExercise(prev, idx, def) : prev))
      setSwappingIdx(null)
      setShowPicker(false)
    },
    []
  )

  // ── Calorie estimates ────────────────────────────────────────
  // The set-reduction and the MET maths both live in lib (pure + tested).
  const getExerciseCalories = (ex: ActiveExercise) =>
    exerciseCalories(ex, userWeightLbs, calorieProfile)

  const totalCalories = workoutCalories(workout, userWeightLbs, calorieProfile)

  // ── Save workout ────────────────────────────────────────────
  // Payload construction, the offline heuristic and the error copy all live in
  // lib/finish-workout.ts (pure + tested); this handles only the IO.
  const finishWorkout = async () => {
    if (!workout || workout.exercises.length === 0) return
    setSaving(true)
    setFinishError(null)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setFinishError("You're signed out — sign in again to save.")
      return
    }

    const payload = buildWorkoutPayload({
      workout,
      userId: user.id,
      finishedAt: new Date(),
      append: appendInfo.current,
    })

    try {
      const logId = await saveWorkout(supabase, payload)
      router.push(`/activity/${logId}`)
    } catch (err) {
      if (isOfflineError(err)) {
        // Don't lose the session — queue it and sync when back online.
        addPending(localStorageQueue, {
          id: crypto.randomUUID(),
          queuedAt: new Date().toISOString(),
          payload,
        })
        router.push("/dashboard?queued=1")
      } else {
        setSaving(false)
        setFinishError(saveErrorMessage(err))
      }
    }
  }

  // Exercises with no checked-off set — these get dropped on save.
  const unchecked = uncheckedExercises(workout)

  // Finish handler: warn first if any exercise has no completed set.
  const handleFinishClick = () => {
    if (!workout || workout.exercises.length === 0) return
    if (unchecked.length > 0) {
      setPendingFinish(true)
      return
    }
    finishWorkout()
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
  const allTimeMinWeight = currentHistory?.allTimeMinWeight ?? null

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
    // Pre-fill the adaptive target weight (progress / repeat / hold from last
    // session) rather than mirroring each set's raw previous weight, so the
    // prescribed session moves with recorded performance.
    const target = adaptiveTarget({
      previousSets: prevSets.map((s) => ({ weight: s.weight, reps: s.reps })),
      repRange: currentExercise.repsTarget,
      increment: suggestedIncrement(currentExercise.muscleGroups ?? []),
      assisted: currentExercise.assisted,
    })
    const fillWeight = target.weight
    if (fillWeight == null) {
      prefilledExercises.current.add(currentExercise.exerciseId)
      return
    }
    setWorkout((prev) => {
      if (!prev) return prev
      const idx = prev.exercises.findIndex((e) => e.exerciseId === exerciseId)
      if (idx === -1) return prev
      const exercises = [...prev.exercises]
      const ex = { ...exercises[idx] }
      ex.sets = ex.sets.map((s) => ({ ...s, weight: fillWeight }))
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
  // Timed hold (e.g. plank "20-30 sec"): the reps column records seconds
  // held, so the header and placeholder must say so.
  const isTimedHold =
    !isCardio && isTimedTarget(currentExercise?.repsTarget)
  // Bodyweight moves (no loadable equipment): there's no weight to enter, so
  // the weight cell shows "Bodyweight" instead of an lbs input.
  const isBodyweight =
    !!currentExercise &&
    isBodyweightLoad({
      equipmentId: currentExercise.equipmentId,
      assisted: currentExercise.assisted,
      exerciseType: currentExercise.exerciseType,
    })
  // Target seconds for the hold timer, parsed from e.g. "20-30 sec".
  const holdTargetSeconds = isTimedHold
    ? Number(currentExercise?.repsTarget?.match(/(\d+)/g)?.slice(-1)[0]) || null
    : null
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
          {appendId && (
            <p className="text-xs font-medium text-purple-600">
              Adding to saved workout
            </p>
          )}
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
          onClick={handleFinishClick}
          disabled={saving || workout.exercises.length === 0}
          className="ml-3 shrink-0"
        >
          {saving ? "Saving..." : appendId ? "Add" : "Finish"}
        </Button>
      </div>

      {finishError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {finishError}
        </p>
      )}

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
              aria-label="Previous exercise"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <button
              onClick={() => setShowDrawer(true)}
              aria-label="Show exercise list"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <List className="h-4 w-4" />
              {currentIdx + 1} / {workout.exercises.length}
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next exercise"
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
                          className="text-[10px]"
                        >
                          {formatMuscleGroup(mg)}
                        </Badge>
                      ))}
                      {getExerciseCalories(currentExercise) > 0 && (
                        <span className="ml-1 flex items-center gap-0.5 text-xs text-orange-500">
                          <Flame className="h-3 w-3" />
                          {getExerciseCalories(currentExercise)} cal
                        </span>
                      )}
                    </div>
                    {/* Prescription from the plan/template. Without this the
                        user has no way to know a plank means a continuous
                        20-30 sec hold, or that the bike can be swapped. */}
                    {currentExercise.repsTarget && (
                      <p className="mt-1.5 text-xs font-medium text-purple-700">
                        Target: {repsTargetLabel(currentExercise.repsTarget)}{" "}
                        per set
                        {isTimedHold && " — one continuous hold"}
                      </p>
                    )}
                    {/* The plan's note is the movement to do TODAY, and it can
                        override the exercise itself — "Pull-Up" carrying
                        "Scapular pulls: … no arm bend" means hangs, not
                        pull-ups. It used to render as grey italic beneath the
                        target and above a generic description saying the
                        opposite, so it read as a footnote and the card looked
                        like it was prescribing a movement the user couldn't
                        do. Called out as the instruction it is. */}
                    {currentExercise.notes && (
                      <p className="mt-1.5 rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-900">
                        <span className="font-semibold">Today: </span>
                        {currentExercise.notes}
                      </p>
                    )}
                    <PreviousPerformance
                      exerciseId={currentExercise.exerciseId}
                      exerciseType={currentExercise.exerciseType}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSwappingIdx(currentIdx)
                        setShowPicker(true)
                      }}
                      className="text-gray-400 hover:text-purple-500"
                      aria-label="Swap exercise"
                      title="Swap exercise (e.g. machine in use or broken)"
                    >
                      <Repeat className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExercise(currentIdx)}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Remove exercise"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* About this exercise: diagram + description + rest */}
                <ExerciseInfo
                  exerciseId={currentExercise.exerciseId}
                  muscleGroups={currentExercise.muscleGroups}
                  restSeconds={currentExercise.restSeconds}
                />

                {/* Progressive overload suggestion (only when there's a
                    rep target and last session cleared it on all sets) */}
                {currentExercise.exerciseType === "strength" && (
                  <AdaptiveTargetBanner
                    exerciseId={currentExercise.exerciseId}
                    repsTarget={currentExercise.repsTarget}
                    muscleGroups={currentExercise.muscleGroups}
                    assisted={currentExercise.assisted}
                    bodyweight={isBodyweight}
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
                      {/* An unloaded hold has no weight column — that cell is
                          the stopwatch, so labelling it "Weight" was wrong. */}
                      <span>
                        {isTimedHold && isBodyweight ? "Timer" : "Weight"}
                      </span>
                      <span>{isTimedHold ? "Sec held" : "Reps"}</span>
                    </>
                  )}
                  <span className="text-center">
                    <Check className="mx-auto h-3.5 w-3.5" />
                  </span>
                </div>

                {/* Set rows */}
                {currentExercise.sets.map((set, si) => {
                  // PR = beats the all-time best AND every earlier completed set
                  // this session. For assisted exercises "best" is the LEAST
                  // weight (assistance), so the comparison flips.
                  const assisted = currentExercise.assisted
                  const earlierWeights = currentExercise.sets
                    .slice(0, si)
                    .filter((s) => s.completed && s.weight != null)
                    .map((s) => s.weight!)
                  const allTimeBest = assisted ? allTimeMinWeight : allTimeMaxWeight
                  const candidates = [
                    ...(allTimeBest != null ? [allTimeBest] : []),
                    ...earlierWeights,
                  ]
                  const threshold = candidates.length
                    ? assisted
                      ? Math.min(...candidates)
                      : Math.max(...candidates)
                    : null
                  const setForPR = { weight: set.weight, reps: set.reps }
                  const isPR =
                    !isCardio &&
                    set.completed &&
                    (assisted
                      ? isNewAssistedRecord(setForPR, threshold)
                      : isNewPersonalRecord(setForPR, threshold))

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
                        {isTimedHold && isBodyweight ? (
                          // An unloaded hold (plank) has no weight to record, so
                          // the weight cell becomes the stopwatch trigger.
                          // A LOADED hold (farmer hold with dumbbells) keeps its
                          // weight input — the load is the whole point of the
                          // exercise — and gets the stopwatch beside the seconds.
                          <button
                            type="button"
                            onClick={() => setHoldTimerSet(si)}
                            className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100"
                          >
                            <Clock className="h-4 w-4" />
                            Time
                          </button>
                        ) : isBodyweight ? (
                          <span className="flex h-10 items-center justify-center rounded-md bg-gray-50 text-center text-xs font-medium text-gray-500">
                            Bodyweight
                          </span>
                        ) : (
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
                        )}
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder={isTimedHold ? "sec" : "reps"}
                            value={set.reps ?? ""}
                            onChange={(e) =>
                              updateSet(currentIdx, si, {
                                reps: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="h-10 flex-1 text-center text-base"
                          />
                          {isTimedHold && !isBodyweight && (
                            <button
                              type="button"
                              onClick={() => setHoldTimerSet(si)}
                              aria-label={`Time set ${si + 1}`}
                              title="Start the hold timer"
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-purple-200 bg-purple-50 text-purple-700 transition-colors hover:bg-purple-100"
                            >
                              <Clock className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {/* Complete / uncomplete */}
                    <button
                      onClick={() => toggleSetComplete(currentIdx, si)}
                      aria-pressed={set.completed}
                      aria-label={
                        set.completed
                          ? `Mark set ${si + 1} incomplete`
                          : `Complete set ${si + 1}`
                      }
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

      {showDrawer && (
        <ExerciseDrawer
          exercises={workout.exercises}
          currentIdx={currentIdx}
          caloriesFor={getExerciseCalories}
          onSelect={(ei) => {
            setCurrentIdx(ei)
            setShowDrawer(false)
          }}
          onClose={() => setShowDrawer(false)}
        />
      )}

      {/* Exercise picker modal — adds a new exercise, or swaps the current
          one when triggered from the swap button. */}
      {showPicker && (
        <ExercisePicker
          onSelect={(def) =>
            swappingIdx !== null
              ? swapExercise(swappingIdx, def)
              : addExercise(def)
          }
          onClose={() => {
            setShowPicker(false)
            setSwappingIdx(null)
          }}
        />
      )}

      {/* Unchecked-exercises confirmation before saving */}
      {pendingFinish && (
        <UncheckedExercisesDialog
          exercises={unchecked}
          saving={saving}
          onCancel={() => setPendingFinish(false)}
          onConfirm={() => {
            setPendingFinish(false)
            finishWorkout()
          }}
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

      {holdTimerSet !== null && (
        <HoldTimer
          targetSeconds={holdTargetSeconds}
          onDone={(secs) => {
            updateSet(currentIdx, holdTimerSet, { reps: secs, completed: true })
            setHoldTimerSet(null)
          }}
          onCancel={() => setHoldTimerSet(null)}
        />
      )}
    </div>
  )
}
