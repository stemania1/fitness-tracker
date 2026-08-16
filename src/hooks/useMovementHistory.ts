"use client"

import { createClient } from "@/lib/supabase/client"
import { useUserQuery } from "@/lib/supabase/user-query"
import { queryKeys } from "@/lib/queries/keys"

const supabase = createClient()

export interface MovementHistoryRow {
  day: string
  steps: number | null
  active_minutes: number | null
}

export interface MovementHistory {
  /** Days the ring reported, from the Oura sync. */
  ring: MovementHistoryRow[]
  /** Days entered by hand, for when the ring wasn't worn. */
  manual: MovementHistoryRow[]
}

/**
 * Recent movement history from both sources.
 *
 * Shared between the dashboard page and the Daily Movement card under one
 * key, so the two agree and the fetch happens once. The page needs it for a
 * narrow reason — deciding whether to render the "Movement" heading at all —
 * but that decision has to account for hand-entered days, or a member with no
 * ring would log a day and watch it disappear into a section that never
 * renders.
 */
export function useMovementHistory(windowDays: number) {
  return useUserQuery<MovementHistory>(
    queryKeys.movementHistory(windowDays),
    async (userId) => {
      const since = new Date(Date.now() - windowDays * 86_400_000)
        .toISOString()
        .slice(0, 10)
      const [ring, manual] = await Promise.all([
        supabase
          .from("oura_daily")
          .select("day, steps, active_minutes")
          .eq("user_id", userId)
          .gte("day", since),
        supabase
          .from("manual_activity_logs")
          .select("day, steps, active_minutes")
          .eq("user_id", userId)
          .gte("day", since),
      ])
      if (ring.error) throw ring.error
      if (manual.error) throw manual.error
      return { ring: ring.data ?? [], manual: manual.data ?? [] }
    }
  )
}

/** Does this user have any movement data at all in the window? */
export function hasMovementData(history: MovementHistory | undefined): boolean {
  if (!history) return false
  return history.ring.length > 0 || history.manual.length > 0
}
