import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getOuraDailySummary } from "@/lib/oura"

/**
 * GET /api/oura — Fetch today's Oura summary for the authenticated user.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get Oura token
  const { data: tokenRow } = await (supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{
            data: { access_token: string; refresh_token: string; expires_at: string } | null
            error: unknown
          }>
        }
      }
    }
  })
    .from("oura_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .single()

  if (!tokenRow) {
    return NextResponse.json({ error: "Oura not connected" }, { status: 404 })
  }

  // Check if token is expired and refresh if needed
  let accessToken = tokenRow.access_token
  const expiresAt = new Date(tokenRow.expires_at)

  if (expiresAt < new Date()) {
    // Refresh the token
    const refreshRes = await fetch("https://api.ouraring.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenRow.refresh_token,
        client_id: process.env.OURA_CLIENT_ID ?? "",
        client_secret: process.env.OURA_CLIENT_SECRET ?? "",
      }),
    })

    if (!refreshRes.ok) {
      return NextResponse.json(
        { error: "Failed to refresh Oura token" },
        { status: 401 }
      )
    }

    const newTokens = (await refreshRes.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    accessToken = newTokens.access_token
    const newExpiresAt = new Date(
      Date.now() + newTokens.expires_in * 1000
    ).toISOString()

    // Update stored tokens
    await (supabase as unknown as {
      from: (table: string) => {
        update: (values: Record<string, string>) => {
          eq: (col: string, val: string) => Promise<unknown>
        }
      }
    })
      .from("oura_tokens")
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: newExpiresAt,
      })
      .eq("user_id", user.id)
  }

  const summary = await getOuraDailySummary(accessToken)
  return NextResponse.json(summary)
}
