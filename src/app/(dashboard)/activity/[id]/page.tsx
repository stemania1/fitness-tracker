"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Dumbbell,
  Loader2,
  Pencil,
  Save,
  Trash2,
  TrendingUp,
  MessageSquare,
  Flame,
  X,
  Plus,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatDuration } from "@/lib/utils"
import { exercises as exerciseCatalog } from "@/data/exercises"
import {
  estimateStrengthCalories,
  estimateCardioCalories,
  type CalorieProfile,
} from "@/lib/calories"
import { estimateOneRepMax } from "@/lib/personal-records"
import { formatMuscleGroup } from "@/lib/muscle-groups"
import { SessionRecapCard } from "@/components/activity/SessionRecapCard"

interface SetLogRow {
  id: string
  set_number: number
  reps: number | null
  weight: number | null
  duration_mins: number | null
  distance_miles: number | null
  incline_percent: number | null
  rpe: number | null
}

interface ExerciseLogRow {
  id: string
  exercise_id: string
  /** Exercise name from the DB `exercises` row (joined). exercise_id is a DB
   *  UUID, so the static catalog is resolved by name, not by that id. */
  name: string | null
  order_index: number
  notes: string | null
  sets: SetLogRow[]
}

interface WorkoutDetail {
  id: string
  name: string
  started_at: string
  finished_at: string | null
  duration_mins: number | null
  notes: string | null
  exercises: ExerciseLogRow[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export default function WorkoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [userWeightLbs, setUserWeightLbs] = useState<number>(170)
  const [calorieProfile, setCalorieProfile] = useState<CalorieProfile>({})
  const [editing, setEditing] = useState<WorkoutDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isEditing = editing !== null

  function startEditing() {
    if (!workout) return
    // Deep clone so user edits don't mutate the original until saved.
    setEditing(
      JSON.parse(JSON.stringify(workout)) as WorkoutDetail
    )
    setSaveError(null)
  }

  function cancelEditing() {
    setEditing(null)
    setSaveError(null)
  }

  function updateSet(
    exerciseLogId: string,
    setId: string,
    patch: Partial<SetLogRow>
  ) {
    setEditing((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id !== exerciseLogId
            ? ex
            : {
                ...ex,
                sets: ex.sets.map((s) =>
                  s.id === setId ? { ...s, ...patch } : s
                ),
              }
        ),
      }
    })
  }

  function updateExerciseNotes(exerciseLogId: string, notes: string) {
    setEditing((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id !== exerciseLogId ? ex : { ...ex, notes }
        ),
      }
    })
  }

  function updateWorkoutNotes(notes: string) {
    setEditing((prev) => (prev ? { ...prev, notes } : prev))
  }

  async function saveEdits() {
    if (!editing) return
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    try {
      // Workout-level notes
      await supabase
        .from("workout_logs")
        .update({ notes: editing.notes })
        .eq("id", editing.id)

      // Per-exercise notes
      for (const ex of editing.exercises) {
        await supabase
          .from("exercise_logs")
          .update({ notes: ex.notes })
          .eq("id", ex.id)
      }

      // Sets
      for (const ex of editing.exercises) {
        for (const s of ex.sets) {
          const { error } = await supabase
            .from("set_logs")
            .update({
              reps: s.reps,
              weight: s.weight,
              duration_mins: s.duration_mins,
              distance_miles: s.distance_miles,
              incline_percent: s.incline_percent,
              rpe: s.rpe,
            })
            .eq("id", s.id)
          if (error) throw error
        }
      }

      setWorkout(editing)
      setEditing(null)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Saved workouts store a DB UUID in exercise_id, so resolve the static
  // catalog entry by the joined exercise name (the two catalogs share names).
  const exerciseByName = useMemo(
    () => new Map(exerciseCatalog.map((e) => [e.name, e])),
    []
  )

  useEffect(() => {
    async function fetch() {
      const supabase = createClient()

      const { data: log } = await supabase
        .from("workout_logs")
        .select("id, name, started_at, finished_at, duration_mins, notes")
        .eq("id", id)
        .single()

      if (!log) {
        setLoading(false)
        return
      }

      const { data: exerciseLogs } = await supabase
        .from("exercise_logs")
        .select("id, exercise_id, order_index, notes, exercises(name)")
        .eq("workout_log_id", id)
        .order("order_index", { ascending: true })

      // The embedded exercises(name) relation isn't in the generated types, so
      // the row type widens to `never` — cast to the shape we selected.
      const rawExerciseLogs = (exerciseLogs ?? []) as Array<{
        id: string
        exercise_id: string
        order_index: number
        notes: string | null
        exercises: { name: string } | { name: string }[] | null
      }>

      const exIds = rawExerciseLogs.map((el) => el.id)
      const { data: setLogs } = await supabase
        .from("set_logs")
        .select(
          "id, exercise_log_id, set_number, reps, weight, duration_mins, distance_miles, incline_percent, rpe"
        )
        .in("exercise_log_id", exIds.length > 0 ? exIds : ["__none__"])
        .order("set_number", { ascending: true })

      const setsByExercise = new Map<string, SetLogRow[]>()
      setLogs?.forEach((s) => {
        const list = setsByExercise.get(s.exercise_log_id) ?? []
        list.push(s)
        setsByExercise.set(s.exercise_log_id, list)
      })

      const exercises: ExerciseLogRow[] = rawExerciseLogs.map((el) => {
        const exRow = Array.isArray(el.exercises)
          ? el.exercises[0]
          : el.exercises
        return {
          id: el.id,
          exercise_id: el.exercise_id,
          name: exRow?.name ?? null,
          order_index: el.order_index,
          notes: el.notes,
          sets: setsByExercise.get(el.id) ?? [],
        }
      })

      setWorkout({ ...log, exercises })

      // Fetch user weight for calorie estimates
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
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

      setLoading(false)
    }
    fetch()
  }, [id])

  const totalVolume = useMemo(() => {
    if (!workout) return 0
    let vol = 0
    workout.exercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        if (s.weight && s.reps) vol += s.weight * s.reps
      })
    })
    return vol
  }, [workout])

  const totalCalories = useMemo(() => {
    if (!workout) return 0
    return workout.exercises.reduce((sum, ex) => {
      const def = exerciseByName.get(ex.name ?? "")
      const calorieId = def?.id ?? ex.exercise_id
      const isCardio = def?.exerciseType === "cardio"
      const isTreadmill = def?.equipmentId === "treadmill"
      const isOutdoorRun = def?.id === "outdoor-run"
      const isDistanceCardio = isTreadmill || isOutdoorRun
      if (isCardio) {
        const totalMins = ex.sets.reduce(
          (s, set) => s + (set.duration_mins ?? 0),
          0
        )
        // For distance-based cardio, derive avg speed from distance/duration
        // so the calorie estimate matches the speed-based MET adjustments.
        let avgSpeed: number | null = null
        if (isDistanceCardio) {
          const speeds = ex.sets
            .map((set) =>
              set.distance_miles != null &&
              set.duration_mins != null &&
              set.duration_mins > 0
                ? set.distance_miles / (set.duration_mins / 60)
                : null
            )
            .filter((v): v is number => v != null && v > 0)
          if (speeds.length > 0) {
            avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length
          }
        }
        // Average incline (treadmill only).
        let avgIncline: number | null = null
        if (isTreadmill) {
          const inclines = ex.sets
            .map((set) => set.incline_percent)
            .filter((v): v is number => v != null && v > 0)
          if (inclines.length > 0) {
            avgIncline =
              inclines.reduce((a, b) => a + b, 0) / inclines.length
          }
        }
        return (
          sum +
          estimateCardioCalories(
            calorieId,
            totalMins,
            userWeightLbs,
            avgSpeed,
            avgIncline,
            calorieProfile
          )
        )
      }
      return sum + estimateStrengthCalories(calorieId, ex.sets.length, userWeightLbs, calorieProfile)
    }, 0)
  }, [workout, userWeightLbs, calorieProfile, exerciseByName])

  const handleDelete = async () => {
    setDeleting(true)
    const supabase = createClient()

    // Delete set_logs -> exercise_logs -> workout_log (cascade should handle, but be explicit)
    const exIds = workout?.exercises.map((e) => e.id) ?? []
    if (exIds.length > 0) {
      await supabase.from("set_logs").delete().in("exercise_log_id", exIds)
      await supabase.from("exercise_logs").delete().eq("workout_log_id", id)
    }
    await supabase.from("workout_logs").delete().eq("id", id)

    router.push("/activity")
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
          <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-gray-500">Workout not found.</p>
        <Button
          variant="link"
          onClick={() => router.push("/activity")}
          className="mt-2"
        >
          Back to Activity
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Back button */}
      <button
        onClick={() => router.push("/activity")}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Activity
      </button>

      {/* Header */}
      <h1 className="mb-1 text-2xl font-bold text-gray-900">{workout.name}</h1>
      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-gray-500">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {formatDate(workout.started_at)}
        </span>
        {workout.duration_mins != null && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {formatDuration(workout.duration_mins)}
          </span>
        )}
      </div>

      {/* How this session compared to previous ones */}
      <SessionRecapCard
        workoutStartedAt={workout.started_at}
        exercises={workout.exercises.map((ex) => {
          const def = exerciseByName.get(ex.name ?? "")
          const weights = ex.sets
            .map((s) => s.weight)
            .filter((w): w is number => w != null)
          return {
            exerciseUuid: ex.exercise_id,
            name: def?.name ?? ex.name ?? "Exercise",
            currentTopWeight: weights.length > 0 ? Math.max(...weights) : null,
          }
        })}
      />

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="flex flex-col items-center p-3">
            <Dumbbell className="mb-1 h-5 w-5 text-purple-500" />
            <span className="text-lg font-bold text-gray-900">
              {workout.exercises.length}
            </span>
            <span className="text-xs text-gray-500">Exercises</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-3">
            <TrendingUp className="mb-1 h-5 w-5 text-purple-500" />
            <span className="text-lg font-bold text-gray-900">
              {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)}
            </span>
            <span className="text-xs text-gray-500">Sets</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-3">
            <TrendingUp className="mb-1 h-5 w-5 text-purple-500" />
            <span className="text-lg font-bold text-gray-900">
              {totalVolume > 0
                ? totalVolume >= 1000
                  ? `${(totalVolume / 1000).toFixed(1)}k`
                  : totalVolume
                : "--"}
            </span>
            <span className="text-xs text-gray-500">Volume (lbs)</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-3">
            <Flame className="mb-1 h-5 w-5 text-orange-500" />
            <span className="text-lg font-bold text-gray-900">
              {totalCalories > 0 ? totalCalories : "--"}
            </span>
            <span className="text-xs text-gray-500">Calories</span>
          </CardContent>
        </Card>
      </div>

      {/* Exercises */}
      <div className="space-y-4">
        {(editing ?? workout).exercises.map((ex) => {
          const def = exerciseByName.get(ex.name ?? "")
          const isCardio = def?.exerciseType === "cardio"
          const isTreadmill = def?.equipmentId === "treadmill"
          const isOutdoorRun = def?.id === "outdoor-run"
          const isDistanceCardio = isTreadmill || isOutdoorRun

          return (
            <Card key={ex.id}>
              <CardContent className="p-4">
                <div className="mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {def?.name ?? ex.name ?? "Exercise"}
                  </h3>
                  {def && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {def.muscleGroups.map((mg) => (
                        <Badge
                          key={mg}
                          variant="default"
                          className="text-[10px]"
                        >
                          {formatMuscleGroup(mg)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sets table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                        <th className="pb-2 pr-4 font-medium">Set</th>
                        {isDistanceCardio ? (
                          <>
                            <th className="pb-2 pr-4 font-medium">Duration</th>
                            <th className="pb-2 pr-4 font-medium">Distance</th>
                            <th className="pb-2 pr-4 font-medium">
                              {isOutdoorRun ? "Pace" : "Avg Speed"}
                            </th>
                            {isTreadmill && (
                              <th className="pb-2 pr-4 font-medium">Incline</th>
                            )}
                          </>
                        ) : isCardio ? (
                          <>
                            <th className="pb-2 pr-4 font-medium">Duration</th>
                            <th className="pb-2 pr-4 font-medium">Distance</th>
                          </>
                        ) : (
                          <>
                            <th className="pb-2 pr-4 font-medium">Weight</th>
                            <th className="pb-2 pr-4 font-medium">Reps</th>
                            <th className="pb-2 pr-4 font-medium">
                              <span title="Estimated 1-rep max (Epley)">
                                Est. 1RM
                              </span>
                            </th>
                          </>
                        )}
                        <th className="pb-2 font-medium">RPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ex.sets.map((s) => {
                        const numCell = (
                          value: number | null,
                          suffix: string,
                          field: keyof SetLogRow,
                          inputMode: "decimal" | "numeric" = "decimal"
                        ) =>
                          isEditing ? (
                            <td className="py-2 pr-2">
                              <Input
                                type="number"
                                inputMode={inputMode}
                                value={value ?? ""}
                                onChange={(e) =>
                                  updateSet(ex.id, s.id, {
                                    [field]: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  } as Partial<SetLogRow>)
                                }
                                className="h-8 w-20 text-center text-sm"
                              />
                            </td>
                          ) : (
                            <td className="py-2 pr-4 text-gray-900">
                              {value != null ? `${value}${suffix}` : "--"}
                            </td>
                          )
                        return (
                        <tr
                          key={s.id}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="py-2 pr-4 font-medium text-gray-500">
                            {s.set_number}
                          </td>
                          {isDistanceCardio ? (
                            <>
                              {numCell(s.duration_mins, " min", "duration_mins")}
                              {numCell(
                                s.distance_miles,
                                " mi",
                                "distance_miles"
                              )}
                              <td className="py-2 pr-4 text-gray-500 tabular-nums">
                                {s.distance_miles != null &&
                                s.duration_mins != null &&
                                s.duration_mins > 0
                                  ? isOutdoorRun
                                    ? (() => {
                                        const mpm =
                                          s.duration_mins / s.distance_miles
                                        const m = Math.floor(mpm)
                                        const sec = Math.round((mpm - m) * 60)
                                        return `${m}:${sec
                                          .toString()
                                          .padStart(2, "0")} /mi`
                                      })()
                                    : `${(
                                        s.distance_miles /
                                        (s.duration_mins / 60)
                                      ).toFixed(1)} mph`
                                  : "--"}
                              </td>
                              {isTreadmill &&
                                numCell(
                                  s.incline_percent,
                                  "%",
                                  "incline_percent"
                                )}
                            </>
                          ) : isCardio ? (
                            <>
                              {numCell(s.duration_mins, " min", "duration_mins")}
                              {numCell(
                                s.distance_miles,
                                " mi",
                                "distance_miles"
                              )}
                            </>
                          ) : (
                            <>
                              {numCell(s.weight, " lbs", "weight")}
                              {numCell(s.reps, "", "reps", "numeric")}
                              <td className="py-2 pr-4 text-gray-500 tabular-nums">
                                {(() => {
                                  const e1rm = estimateOneRepMax(
                                    s.weight,
                                    s.reps
                                  )
                                  return e1rm != null
                                    ? `${Math.round(e1rm)}`
                                    : "--"
                                })()}
                              </td>
                            </>
                          )}
                          {numCell(s.rpe, "", "rpe", "numeric")}
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Exercise notes */}
                {isEditing ? (
                  <textarea
                    value={ex.notes ?? ""}
                    onChange={(e) =>
                      updateExerciseNotes(ex.id, e.target.value)
                    }
                    placeholder="Notes for this exercise…"
                    className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={2}
                  />
                ) : (
                  ex.notes && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <p className="text-sm text-gray-600">{ex.notes}</p>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Workout notes */}
      {isEditing ? (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm font-medium text-gray-500">
              Workout Notes
            </h3>
            <textarea
              value={editing?.notes ?? ""}
              onChange={(e) => updateWorkoutNotes(e.target.value)}
              placeholder="Overall workout notes…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
            />
          </CardContent>
        </Card>
      ) : (
        workout.notes && (
          <Card className="mt-4">
            <CardContent className="p-4">
              <h3 className="mb-1 text-sm font-medium text-gray-500">
                Workout Notes
              </h3>
              <p className="text-sm text-gray-700">{workout.notes}</p>
            </CardContent>
          </Card>
        )
      )}

      {/* Edit / Delete actions */}
      <div className="mt-8 border-t border-gray-100 pt-6">
        {isEditing ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                onClick={saveEdits}
                disabled={saving}
                className="gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button
                variant="secondary"
                onClick={cancelEditing}
                disabled={saving}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
          </div>
        ) : showDeleteConfirm ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="mb-3 text-sm font-medium text-red-800">
              Are you sure you want to delete this workout? This cannot be
              undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? "Deleting..." : "Delete"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => router.push(`/activity/log?append=${workout.id}`)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add exercises
            </Button>
            <Button
              variant="secondary"
              onClick={startEditing}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" />
              Edit workout
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
