import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getOuraMetricsHistory } from "@/lib/oura"
import { resolveOuraAccessToken } from "@/lib/oura-token"

const DEFAULT_WINDOW_DAYS = 60
const MAX_WINDOW_DAYS = 180

/**
 * GET /api/oura/metrics — daily REM/stress/activity/readiness history for the
 * authenticated user, for sleep-correlation analysis. Optional ?days=N
 * (clamped 7..180, default 60).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = await resolveOuraAccessToken(supabase, user.id)
  if (!token.ok) {
    return token.reason === "not_connected"
      ? NextResponse.json({ error: "Oura not connected" }, { status: 404 })
      : NextResponse.json(
          { error: "Failed to refresh Oura token" },
          { status: 401 }
        )
  }

  // Number(null) and Number("") are both 0, so check the raw param is
  // present and numeric before using it — otherwise fall back to the default.
  const rawDays = searchParams.get("days")
  const requested = rawDays != null && rawDays.trim() !== "" ? Number(rawDays) : NaN
  const days = Number.isFinite(requested)
    ? Math.min(MAX_WINDOW_DAYS, Math.max(7, Math.round(requested)))
    : DEFAULT_WINDOW_DAYS

  const end = new Date().toISOString().slice(0, 10)
  const startDate = new Date(`${end}T00:00:00Z`)
  startDate.setUTCDate(startDate.getUTCDate() - days)
  const start = startDate.toISOString().slice(0, 10)

  const data = await getOuraMetricsHistory(token.accessToken, start, end)
  return NextResponse.json({ data })
}
