import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getOuraVo2MaxHistory } from "@/lib/oura"
import { resolveOuraAccessToken } from "@/lib/oura-token"

const DEFAULT_WINDOW_DAYS = 180

/**
 * GET /api/oura/vo2max — Oura VO2 Max history for the authenticated user.
 * Optional ?start=YYYY-MM-DD&end=YYYY-MM-DD (inclusive); defaults to the
 * last 180 days ending today (UTC).
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

  const end = searchParams.get("end") ?? new Date().toISOString().slice(0, 10)
  const start =
    searchParams.get("start") ??
    (() => {
      const d = new Date(`${end}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() - DEFAULT_WINDOW_DAYS)
      return d.toISOString().slice(0, 10)
    })()

  const data = await getOuraVo2MaxHistory(token.accessToken, start, end)
  return NextResponse.json({ data })
}
