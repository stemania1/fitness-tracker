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
  Trash2,
  TrendingUp,
  MessageSquare,
  Flame,
} from "lucide-react"
import { formatDuration } from "@/lib/utils"
import { exercises as exerciseCatalog } from "@/data/exercises"
import {
  estimateStrengthCalories,
  estimateCardioCalories,
} from "@/lib/calories"
import { estimateOneRepMax } from "@/lib/personal-records"

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

  const exerciseMap = useMemo(
    () => new Map(exerciseCatalog.map((e) => [e.id, e])),
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
        .select("id, exercise_id, order_index, notes")
        .eq("workout_log_id", id)
        .order("order_index", { ascending: true })

      const exIds = (exerciseLogs ?? []).map((el) => el.id)
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

      const exercises: ExerciseLogRow[] = (exerciseLogs ?? []).map((el) => ({
        ...el,
        sets: setsByExercise.get(el.id) ?? [],
      }))

      setWorkout({ ...log, exercises })

      // Fetch user weight for calorie estimates
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("current_weight")
          .eq("id", user.id)
          .single()
        if (profile?.current_weight) setUserWeightLbs(profile.current_weight)
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
      const def = exerciseMap.get(ex.exercise_id)
      const isCardio = def?.exerciseType === "cardio"
      const isTreadmill = def?.equipmentId === "treadmill"
      if (isCardio) {
        const totalMins = ex.sets.reduce(
          (s, set) => s + (set.duration_mins ?? 0),
          0
        )
        // For treadmill, derive avg speed from distance/duration so the
        // calorie estimate matches the speed-based MET adjustments.
        let avgSpeed: number | null = null
        if (isTreadmill) {
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
        return (
          sum +
          estimateCardioCalories(
            ex.exercise_id,
            totalMins,
            userWeightLbs,
            avgSpeed
          )
        )
      }
      return sum + estimateStrengthCalories(ex.exercise_id, ex.sets.length, userWeightLbs)
    }, 0)
  }, [workout, userWeightLbs, exerciseMap])

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
        {workout.exercises.map((ex) => {
          const def = exerciseMap.get(ex.exercise_id)
          const isCardio = def?.exerciseType === "cardio"
          const isTreadmill = def?.equipmentId === "treadmill"

          return (
            <Card key={ex.id}>
              <CardContent className="p-4">
                <div className="mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {def?.name ?? ex.exercise_id}
                  </h3>
                  {def && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {def.muscleGroups.map((mg) => (
                        <Badge
                          key={mg}
                          variant="default"
                          className="text-[10px] capitalize"
                        >
                          {mg.replace("_", " ")}
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
                        {isTreadmill ? (
                          <>
                            <th className="pb-2 pr-4 font-medium">Duration</th>
                            <th className="pb-2 pr-4 font-medium">Distance</th>
                            <th className="pb-2 pr-4 font-medium">Avg Speed</th>
                            <th className="pb-2 pr-4 font-medium">Incline</th>
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
                      {ex.sets.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="py-2 pr-4 font-medium text-gray-500">
                            {s.set_number}
                          </td>
                          {isTreadmill ? (
                            <>
                              <td className="py-2 pr-4 text-gray-900">
                                {s.duration_mins != null
                                  ? `${s.duration_mins} min`
                                  : "--"}
                              </td>
                              <td className="py-2 pr-4 text-gray-900">
                                {s.distance_miles != null
                                  ? `${s.distance_miles} mi`
                                  : "--"}
                              </td>
                              <td className="py-2 pr-4 text-gray-900">
                                {s.distance_miles != null &&
                                s.duration_mins != null &&
                                s.duration_mins > 0
                                  ? `${(
                                      s.distance_miles /
                                      (s.duration_mins / 60)
                                    ).toFixed(1)} mph`
                                  : "--"}
                              </td>
                              <td className="py-2 pr-4 text-gray-900">
                                {s.incline_percent != null
                                  ? `${s.incline_percent}%`
                                  : "--"}
                              </td>
                            </>
                          ) : isCardio ? (
                            <>
                              <td className="py-2 pr-4 text-gray-900">
                                {s.duration_mins != null
                                  ? `${s.duration_mins} min`
                                  : "--"}
                              </td>
                              <td className="py-2 pr-4 text-gray-900">
                                {s.distance_miles != null
                                  ? `${s.distance_miles} mi`
                                  : "--"}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 pr-4 text-gray-900">
                                {s.weight != null ? `${s.weight} lbs` : "--"}
                              </td>
                              <td className="py-2 pr-4 text-gray-900">
                                {s.reps ?? "--"}
                              </td>
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
                          <td className="py-2 text-gray-500">
                            {s.rpe ?? "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Exercise notes */}
                {ex.notes && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <p className="text-sm text-gray-600">{ex.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Workout notes */}
      {workout.notes && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h3 className="mb-1 text-sm font-medium text-gray-500">
              Workout Notes
            </h3>
            <p className="text-sm text-gray-700">{workout.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Delete button */}
      <div className="mt-8 border-t border-gray-100 pt-6">
        {showDeleteConfirm ? (
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
          <Button
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
            className="gap-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Delete Workout
          </Button>
        )}
      </div>
    </div>
  )
}
