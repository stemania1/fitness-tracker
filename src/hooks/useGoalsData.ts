"use client"

/**
 * The Goals page's reads, one hook per query. Extracted from the page so the
 * page is composition and the query shapes are in one greppable place.
 */

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/user-query"
import {
  toDatedExerciseRows,
  type JoinedWorkoutRow,
} from "@/lib/goal-exercise-rows"
import type { DatedExerciseRow } from "@/lib/goal-trend"
import type { UserGoal } from "@/types/database"

const supabase = createClient()

export function useGoals() {
  return useQuery({
    queryKey: ["user-goals"],
    queryFn: async () => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("user_goals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as UserGoal[]
    },
  })
}

export function useWeightLogs() {
  return useQuery({
    queryKey: ["weight-logs"],
    queryFn: async () => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("weight_logs")
        .select("*")
        .eq("user_id", userId)
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useWorkoutLogs() {
  return useQuery({
    queryKey: ["workout-logs-all"],
    queryFn: async () => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("workout_logs")
        // Must match the other ["workout-logs-all"] definitions — same key,
        // same shape, or whichever mounts first decides what the others read.
        .select("id, started_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useSetLogs() {
  return useQuery({
    queryKey: ["set-logs-all"],
    queryFn: async () => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("workout_logs")
        .select("started_at, exercise_logs(set_logs(weight, reps))")
        .eq("user_id", userId)
        .order("started_at", { ascending: true })
      if (error) throw error
      return data
    },
  })
}

/** Logged exercises shaped for computeExerciseBests: resolves each logged
 *  exercise's DB name back to its static catalog id so strength/endurance
 *  goals (which store the static id) can be matched. */
export function useExerciseBests() {
  return useQuery({
    queryKey: ["goal-exercise-bests"],
    queryFn: async (): Promise<DatedExerciseRow[]> => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("workout_logs")
        .select(
          "started_at, exercise_logs(exercises(name), set_logs(weight, reps, duration_mins, distance_miles))"
        )
        .eq("user_id", userId)
      if (error) throw error
      return toDatedExerciseRows((data ?? []) as JoinedWorkoutRow[])
    },
  })
}
