import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getOuraDailyHistory } from "@/lib/oura"
import { resolveOuraAccessToken } from "@/lib/oura-token"
import { localDateString as ymd } from "@/lib/dates"

export const runtime = "nodejs"

/** How far back to backfill on each sync. */
const BACKFILL_DAYS = 90

/**
 * POST /api/oura/sync — backfill/refresh the caller's stored Oura daily
 * history (sleep + readiness + steps) for the last ~90 days. Idempotent
 * upsert on (user_id, day); the client calls it about once a day. Returns
 * quietly with `synced: 0` when Oura isn't connected, so it's safe to
 * fire-and-forget.
 *
 * Re-upserting the window rather than only new days is what keeps the current
 * day's step count honest: today's row is written again on every sync, so a
 * total captured at noon is replaced by the fuller one later.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = await resolveOuraAccessToken(supabase, user.id)
  if (!token.ok) {
    // Not connected / refresh failed — nothing to sync, not an error the
    // fire-and-forget caller should care about.
    return NextResponse.json({ synced: 0, connected: false })
  }

  const end = new Date()
  const start = new Date(end.getTime() - BACKFILL_DAYS * 86_400_000)
  const records = await getOuraDailyHistory(token.accessToken, ymd(start), ymd(end))

  if (records.length === 0) {
    return NextResponse.json({ synced: 0, connected: true })
  }

  const rows = records.map((r) => ({
    user_id: user.id,
    day: r.day,
    sleep_score: r.sleepScore,
    sleep_minutes: r.sleepMinutes,
    readiness_score: r.readinessScore,
    average_hrv: r.averageHrv,
    steps: r.steps,
    active_calories: r.activeCalories,
    activity_score: r.activityScore,
    active_minutes: r.activeMinutes,
  }))

  const { error } = await supabase
    .from("oura_daily")
    .upsert(rows, { onConflict: "user_id,day" })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ synced: rows.length, connected: true })
}
