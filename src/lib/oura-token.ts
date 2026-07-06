/**
 * Shared Oura OAuth token resolution for API routes: load the user's
 * stored token, refresh it if expired, persist the rotated pair.
 */

import type { createServerSupabaseClient } from "@/lib/supabase/server"

type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>

export type OuraTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "not_connected" | "refresh_failed" }

export async function resolveOuraAccessToken(
  supabase: ServerSupabaseClient,
  userId: string
): Promise<OuraTokenResult> {
  const { data: tokenRow } = await supabase
    .from("oura_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single()

  if (!tokenRow) {
    return { ok: false, reason: "not_connected" }
  }

  const expiresAt = new Date(tokenRow.expires_at)
  if (expiresAt >= new Date()) {
    return { ok: true, accessToken: tokenRow.access_token }
  }

  // Token expired — refresh it.
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
    const body = await refreshRes.text().catch(() => "(unreadable)")
    console.error(
      `[Oura API] Token refresh failed — status ${refreshRes.status}: ${body}`
    )
    return { ok: false, reason: "refresh_failed" }
  }

  const newTokens = (await refreshRes.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  const newExpiresAt = new Date(
    Date.now() + newTokens.expires_in * 1000
  ).toISOString()

  await supabase
    .from("oura_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: newExpiresAt,
    })
    .eq("user_id", userId)

  return { ok: true, accessToken: newTokens.access_token }
}
