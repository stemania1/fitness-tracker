import type { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queries/keys"

/**
 * Everything a saved workout invalidates.
 *
 * This was ad hoc, and the two save paths disagreed. `TodaysWorkoutSession`
 * invalidated three keys; `finishWorkout` in the logger — the path most
 * workouts actually go through — invalidated nothing at all. With a 60s
 * staleTime, finishing a workout and landing on the dashboard showed the
 * previous count in This Week, an unchanged streak, stale calories burned,
 * and no sign of a PR you had just set.
 *
 * Listing the affected keys once means the next person to add a
 * workout-derived query has one place to register it, rather than three call
 * sites to remember.
 *
 * Keys are passed as prefixes on purpose: React Query matches
 * `["weekly-workouts"]` against `["weekly-workouts", weekStart]`, so this
 * catches every week and every cached day without enumerating them.
 */
export function invalidateWorkoutData(queryClient: QueryClient): void {
  const affected = [
    queryKeys.workoutLogsAll,
    queryKeys.recentWorkouts,
    queryKeys.workoutHistory,
    ["weekly-workouts"],
    ["weekly-calories"],
    queryKeys.allStrengthSets,
    queryKeys.setLogsAll,
    queryKeys.goalExerciseBests,
    queryKeys.weeklyDigest,
    ["muscle-balance"],
  ]
  for (const queryKey of affected) {
    queryClient.invalidateQueries({ queryKey: queryKey as unknown as string[] })
  }
}
