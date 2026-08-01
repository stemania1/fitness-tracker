"use client"

import { useMemo } from "react"
import { buildBedtimePlan, type BedtimePlan } from "@/lib/bedtime"
import { useProfile } from "@/hooks/useProfile"

/**
 * The user's sleep-anchored bedtime plan — bedtime, wind-down and the
 * last-safe-caffeine cutoff, worked back from their wake time and sleep goal.
 *
 * Shared rather than re-queried per card: three consumers need the same two
 * profile columns, and they must agree. The Bedtime card telling you to stop
 * caffeine at 2:30pm while the caffeine warning judged you against 2pm is the
 * sort of inconsistency that makes the advice feel arbitrary.
 *
 * `plan` is null when no wake time is on file; callers fall back to their own
 * defaults rather than being handed a guessed schedule.
 */
export function useBedtimePlan(): {
  plan: BedtimePlan | null
  isLoading: boolean
} {
  const { data: profile, isLoading } = useProfile()

  // Memoized on the two inputs: consumers put the plan (or its cutoff) in
  // useMemo dependency lists, and a fresh object every render would recompute
  // them every render.
  const wakeTime = profile?.wake_time ?? null
  const sleepGoalHours = profile?.sleep_goal_hours ?? null
  const plan = useMemo(
    () =>
      wakeTime
        ? buildBedtimePlan(wakeTime, sleepGoalHours ?? undefined)
        : null,
    [wakeTime, sleepGoalHours]
  )

  return { plan, isLoading }
}
