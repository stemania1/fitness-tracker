"use client"

import { createClient } from "@/lib/supabase/client"
import { useUserQuery } from "@/lib/supabase/user-query"
import type { UserProfile } from "@/types/database"

const supabase = createClient()

/**
 * The signed-in user's profile row — one query, one cache key.
 *
 * This was previously fetched under eight different keys, each selecting a
 * narrow column subset: ["profile"], ["weight-target-profile"],
 * ["this-week-profile"], ["insights-profile"], ["express-profile"],
 * ["bedtime-profile"], ["oura-card-age"] and the profile half of
 * ["weekly-calories"]. Seven were reachable on a single dashboard mount, and
 * ThisWeekCard fetched the row twice by itself.
 *
 * Narrowing the columns bought nothing — it is one row, and the bytes saved
 * were dwarfed by the extra round-trip each key cost. The real damage was
 * invalidation: QuickLogWeight writes current_weight and invalidates
 * ["profile"], so ["weekly-calories"] kept computing MET calories from a
 * stale weight until its own key happened to refetch.
 *
 * Consumers take the whole row and pick the fields they need.
 */
export function useProfile() {
  return useUserQuery<UserProfile | null>(["profile"], async (userId) => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single()
    if (error) throw error
    return data
  })
}
