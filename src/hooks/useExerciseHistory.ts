"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { exercises as exerciseCatalog } from "@/data/exercises"

export interface PreviousSetRow {
  set_number: number
  reps: number | null
  weight: number | null
  duration_mins: number | null
  distance_miles: number | null
  incline_percent: number | null
}

export interface ExerciseHistory {
  /** Sets from the most recent logged session, set_number ascending. */
  previousSets: PreviousSetRow[]
  /** All-time heaviest weight ever logged for this exercise (any reps). */
  allTimeMaxWeight: number | null
}

async function fetchExerciseHistory(
  exerciseStaticId: string
): Promise<ExerciseHistory | null> {
  const supabase = createClient()

  const staticExercise = exerciseCatalog.find((e) => e.id === exerciseStaticId)
  if (!staticExercise) return null

  const { data: dbExercise } = await supabase
    .from("exercises")
    .select("id")
    .eq("name", staticExercise.name)
    .single()
  if (!dbExercise) return null

  // Find the most recent workout that included this exercise.
  const { data: recentExLogs } = await supabase
    .from("exercise_logs")
    .select("id, workout_log_id")
    .eq("exercise_id", dbExercise.id)
    .order("workout_log_id", { ascending: false })
    .limit(20)

  let previousSets: PreviousSetRow[] = []
  if (recentExLogs && recentExLogs.length > 0) {
    const workoutIds = recentExLogs.map((el) => el.workout_log_id)
    const { data: workouts } = await supabase
      .from("workout_logs")
      .select("id, started_at")
      .in("id", workoutIds)
      .order("started_at", { ascending: false })
      .limit(1)

    const latestExLog = workouts?.[0]
      ? recentExLogs.find((el) => el.workout_log_id === workouts[0].id)
      : null

    if (latestExLog) {
      const { data: sets } = await supabase
        .from("set_logs")
        .select(
          "set_number, reps, weight, duration_mins, distance_miles, incline_percent"
        )
        .eq("exercise_log_id", latestExLog.id)
        .order("set_number", { ascending: true })
      previousSets = sets ?? []
    }
  }

  // All-time max weight across every set ever logged for this exercise.
  // Two-step (RLS-friendly) lookup: list exercise_log ids, then read the
  // weights from set_logs.
  let allTimeMaxWeight: number | null = null
  if (recentExLogs && recentExLogs.length > 0) {
    // We need every exercise_log for this exercise, not just the 20 above.
    const { data: allExLogs } = await supabase
      .from("exercise_logs")
      .select("id")
      .eq("exercise_id", dbExercise.id)

    const ids = (allExLogs ?? []).map((r) => r.id)
    if (ids.length > 0) {
      const { data: allSets } = await supabase
        .from("set_logs")
        .select("weight, reps")
        .in("exercise_log_id", ids)
        .not("weight", "is", null)

      for (const s of (allSets ?? []) as Array<{
        weight: number | null
        reps: number | null
      }>) {
        if (s.weight == null) continue
        if (s.reps != null && s.reps < 1) continue
        if (allTimeMaxWeight == null || s.weight > allTimeMaxWeight) {
          allTimeMaxWeight = s.weight
        }
      }
    }
  }

  return { previousSets, allTimeMaxWeight }
}

/**
 * Hook that returns the most recent session's sets and all-time max weight
 * for a given static exercise slug. Both are needed by:
 * - Previous Performance display
 * - Progressive overload suggestion
 * - Personal-record detection during active workout
 */
export function useExerciseHistory(exerciseStaticId: string) {
  return useQuery({
    queryKey: ["exercise-history", exerciseStaticId],
    queryFn: () => fetchExerciseHistory(exerciseStaticId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
