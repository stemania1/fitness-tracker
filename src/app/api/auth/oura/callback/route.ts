import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * Oura OAuth2 callback handler.
 * Oura redirects here after the user authorizes the app.
 * Exchanges the authorization code for access + refresh tokens
 * and stores them in the user's profile.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/profile?oura=error", request.url)
    )
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://api.ouraring.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.OURA_CLIENT_ID ?? "",
      client_secret: process.env.OURA_CLIENT_SECRET ?? "",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://fitness.craigfamilywebsite.com"}/api/auth/oura/callback`,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/profile?oura=error", request.url)
    )
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
  }

  // Store tokens in Supabase for the authenticated user
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString()

  // Upsert into oura_tokens table
  // Note: oura_tokens table must be created via migration before this works
  await (supabase as unknown as { from: (table: string) => { upsert: (values: Record<string, string>, options?: Record<string, string>) => Promise<unknown> } })
    .from("oura_tokens")
    .upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      },
      { onConflict: "user_id" }
    )

  return NextResponse.redirect(
    new URL("/profile?oura=connected", request.url)
  )
}
