"use client"

import { createClient } from "@/lib/supabase/client"
import { useUserQuery } from "@/lib/supabase/user-query"
import { queryKeys } from "@/lib/queries/keys"
import { daysAgoDateString } from "@/lib/dates"
import type { EnergyLevel } from "@/lib/energy"

const supabase = createClient()

/**
 * The day-scoped log reads, defined once each.
 *
 * The dashboard and the cards were fetching the same rows under different
 * keys — `["caffeine-today"]` against `["caffeine-today-list", dayStart]`,
 * `["creatine-today", day]` against `["creatine-logs", day]`,
 * `["energy-fuel-today"]` against `["food-logs-today", startIso]`,
 * `["energy-checkin-exists", day]` against `["energy-checkins", day]`.
 *
 * In every pair the dashboard wanted a thin "did this happen today?" boolean
 * while the card wanted the rows. The boolean is derivable from the rows, so
 * the second query bought nothing but a round-trip and the chance for the two
 * to disagree on screen — the card showing a logged meal while the nudge
 * still said "log a meal".
 */

export interface FoodLogRow {
  id: string
  description: string
  meal_type: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sugar_g: number
  glycemic_load: number
  confidence: "low" | "medium" | "high" | null
  image_path: string | null
  logged_at: string
}

/** Meals logged in `[startIso, endIso)`. */
export function useFoodLogs(startIso: string, endIso: string) {
  return useUserQuery<FoodLogRow[]>(
    queryKeys.foodLogsToday(startIso),
    async (userId) => {
      const { data, error } = await supabase
        .from("food_logs")
        .select(
          "id, description, meal_type, calories, protein_g, carbs_g, fat_g, sugar_g, glycemic_load, confidence, image_path, logged_at"
        )
        .eq("user_id", userId)
        .gte("logged_at", startIso)
        .lt("logged_at", endIso)
        .order("logged_at", { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as FoodLogRow[]
    }
  )
}

export interface CaffeineRow {
  id: string
  mg: number
  source: string | null
  logged_at: string
}

/** Caffeine logged on or after `dayStartIso`. */
export function useCaffeineLogs(dayStartIso: string) {
  return useUserQuery<CaffeineRow[]>(
    queryKeys.caffeineToday(dayStartIso),
    async (userId) => {
      const { data, error } = await supabase
        .from("caffeine_logs")
        .select("id, mg, source, logged_at")
        .eq("user_id", userId)
        .gte("logged_at", dayStartIso)
        .order("logged_at", { ascending: true })
      if (error) throw error
      return (data ?? []) as CaffeineRow[]
    }
  )
}

export interface CreatineRow {
  taken_on: string
  dose_g: number | null
}

/**
 * Creatine history plus the user's daily target. The window is wide enough
 * to cover any realistic streak, so "taken today" and "current streak" come
 * from the same read.
 */
export function useCreatineLogs(day: string) {
  return useUserQuery(queryKeys.creatineLogs(day), async (userId) => {
    const sinceStr = daysAgoDateString(400)
    const [logsRes, profileRes] = await Promise.all([
      supabase
        .from("creatine_logs")
        .select("taken_on, dose_g")
        .eq("user_id", userId)
        .gte("taken_on", sinceStr)
        .order("taken_on", { ascending: false }),
      supabase
        .from("user_profiles")
        .select("creatine_target_g")
        .eq("id", userId)
        .single(),
    ])
    if (logsRes.error) throw logsRes.error
    return {
      logs: (logsRes.data ?? []) as CreatineRow[],
      targetG: profileRes.data?.creatine_target_g ?? null,
    }
  })
}

/** The most recent energy check-in for `day`, or null if there isn't one. */
export function useEnergyCheckin(day: string) {
  return useUserQuery<EnergyLevel | null>(
    queryKeys.energyCheckins(day),
    async (userId) => {
      const { data, error } = await supabase
        .from("energy_checkins")
        .select("level")
        .eq("user_id", userId)
        .eq("logged_on", day)
        .order("created_at", { ascending: false })
        .limit(1)
      if (error) throw error
      return (data?.[0]?.level ?? null) as EnergyLevel | null
    }
  )
}

/** When the user last weighed in, or null if they never have. */
export function useLastWeighIn() {
  return useUserQuery<string | null>(queryKeys.lastWeighIn, async (userId) => {
    const { data, error } = await supabase
      .from("weight_logs")
      .select("logged_at")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(1)
    if (error) throw error
    return (data?.[0]?.logged_at ?? null) as string | null
  })
}
