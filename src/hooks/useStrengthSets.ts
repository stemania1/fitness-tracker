"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { exercises as exerciseCatalog } from "@/data/exercises"
import type { SetWithMeta } from "@/lib/personal-records"

const supabase = createClient()

/**
 * Every strength set the user has ever logged, mapped to the shape the PR
 * detector (`findRecentPRs`/`findRecentRepPRs`) and the weekly-volume trend
 * (`buildWeeklyVolumeTrend`) both consume.
 *
 * Shared via a hook so the dashboard's Volume Trend and the Insights Recent
 * PRs card each derive from a single query definition. They use the same
 * React Query key, so the join runs once and both read the same cache.
 */
export function useStrengthSets() {
  const exerciseNameMap = useMemo(
    () => new Map(exerciseCatalog.map((e) => [e.name.toLowerCase(), e])),
    []
  )

  return useQuery({
    queryKey: ["all-strength-sets"],
    queryFn: async (): Promise<SetWithMeta[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("set_logs")
        .select(`
          weight,
          reps,
          exercise_log:exercise_logs!inner(
            exercise:exercises!inner(name, exercise_type),
            workout_log:workout_logs!inner(user_id, started_at)
          )
        `)
        .eq("exercise_log.workout_log.user_id", user.id)
        .eq("exercise_log.exercise.exercise_type", "strength")
        .not("weight", "is", null)
      if (error) throw error

      type Row = {
        weight: number | null
        reps: number | null
        exercise_log: {
          exercise: { name: string }
          workout_log: { started_at: string }
        } | null
      }
      const rows = (data ?? []) as unknown as Row[]
      return rows
        .map((r) => {
          const exerciseName = r.exercise_log?.exercise?.name ?? ""
          return {
            exerciseName,
            weight: r.weight,
            reps: r.reps,
            startedAt: r.exercise_log?.workout_log?.started_at ?? "",
            assisted:
              exerciseNameMap.get(exerciseName.toLowerCase())?.assisted ?? false,
          }
        })
        .filter((s) => s.exerciseName && s.startedAt)
    },
  })
}
