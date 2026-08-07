"use client"

/**
 * The personal caffeine model, learned from the last 60 days of energy
 * check-ins and caffeine logs. All the reasoning is in lib/caffeine-personal
 * (pure + tested); this fetches the two histories and memoizes the fit.
 * Falls back to the population half-life until there's enough data.
 */

import { useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUserQuery } from "@/lib/supabase/user-query"
import {
  buildCaffeineCheckins,
  learnCaffeineModel,
  type PersonalCaffeineModel,
  type CheckinRow,
  type CaffeineLogRow,
} from "@/lib/caffeine-personal"
import { daysAgoDateString } from "@/lib/dates"

const supabase = createClient()

/** Enough history to fit from, recent enough to track habit changes. */
const WINDOW_DAYS = 60

export function useCaffeineModel(): PersonalCaffeineModel {
  const { data } = useUserQuery(["caffeine-model"], async (userId) => {
    const since = daysAgoDateString(WINDOW_DAYS)
    const [checkins, caffeine] = await Promise.all([
      supabase
        .from("energy_checkins")
        .select("level, logged_on, logged_hour")
        .eq("user_id", userId)
        .gte("logged_on", since),
      supabase
        .from("caffeine_logs")
        .select("mg, logged_at")
        .eq("user_id", userId)
        .gte("logged_at", `${since}T00:00:00`),
    ])
    if (checkins.error) throw checkins.error
    if (caffeine.error) throw caffeine.error
    return {
      checkins: (checkins.data ?? []) as CheckinRow[],
      caffeine: (caffeine.data ?? []) as CaffeineLogRow[],
    }
  })

  return useMemo(
    () =>
      learnCaffeineModel(
        buildCaffeineCheckins(data?.checkins ?? [], data?.caffeine ?? [])
      ),
    [data]
  )
}
