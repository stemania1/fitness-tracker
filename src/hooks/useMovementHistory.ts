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
}

/**
 * Recent movement history from the Oura sync.
 *
 * Shared between the dashboard page and the Daily Movement card under one
 * key, so the two agree and the fetch happens once. The page needs it only to
 * decide whether to render the "Movement" heading at all.
 */
export function useMovementHistory(windowDays: number) {
  return useUserQuery<MovementHistory>(
    queryKeys.movementHistory(windowDays),
    async (userId) => {
      const since = new Date(Date.now() - windowDays * 86_400_000)
        .toISOString()
        .slice(0, 10)
      const ring = await supabase
        .from("oura_daily")
        .select("day, steps, active_minutes")
        .eq("user_id", userId)
        .gte("day", since)
      if (ring.error) throw ring.error
      return { ring: ring.data ?? [] }
    }
  )
}

/** Does this user have any movement data at all in the window? */
export function hasMovementData(history: MovementHistory | undefined): boolean {
  if (!history) return false
  return history.ring.length > 0
}
