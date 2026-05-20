import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * Oura OAuth2 callback handler.
 * Oura redirects here after the user authorizes the app.
 * Exchanges the authorization code for access + refresh tokens
 * and stores them in the user's profile.
 *
 * On failure, redirects to /profile?oura=error&oura_reason=<code> so the
 * profile page can show targeted troubleshooting steps.
 */

type OuraErrorReason =
  | "user_denied"
  | "missing_code"
  | "missing_env"
  | "token_exchange"
  | "not_authenticated"
  | "db_write"

function errorRedirect(request: NextRequest, reason: OuraErrorReason) {
  const url = new URL("/profile", request.url)
  url.searchParams.set("oura", "error")
  url.searchParams.set("oura_reason", reason)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  // If no code and no error, this is likely a validation ping from Oura's
  // developer portal — return 200 OK so it accepts the redirect URI.
  if (!code && !error) {
    return new NextResponse("OK", { status: 200 })
  }

  if (error) {
    console.error("[Oura OAuth] Authorization error from Oura:", error)
    return errorRedirect(request, error === "access_denied" ? "user_denied" : "missing_code")
  }

  if (!code) {
    console.error("[Oura OAuth] No authorization code received")
    return errorRedirect(request, "missing_code")
  }

  // Verify env vars are present
  const clientId = process.env.OURA_CLIENT_ID
  const clientSecret = process.env.OURA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error("[Oura OAuth] Missing OURA_CLIENT_ID or OURA_CLIENT_SECRET environment variables")
    return errorRedirect(request, "missing_env")
  }

  // Exchange code for tokens
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://fitness.craigfamilywebsite.com"}/api/auth/oura/callback`
  let tokenRes: Response

  try {
    tokenRes = await fetch("https://api.ouraring.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    })
  } catch (err) {
    console.error("[Oura OAuth] Network error during token exchange:", err)
    return errorRedirect(request, "token_exchange")
  }

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "(unreadable)")
    console.error(
      `[Oura OAuth] Token exchange failed — status ${tokenRes.status}: ${body}`
    )
    return errorRedirect(request, "token_exchange")
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
    console.error("[Oura OAuth] No authenticated user found in session")
    return errorRedirect(request, "not_authenticated")
  }

  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString()

  // Upsert into oura_tokens table
  const { error: dbError } = await supabase
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

  if (dbError) {
    console.error("[Oura OAuth] Failed to store tokens:", dbError.message)
    return errorRedirect(request, "db_write")
  }

  return NextResponse.redirect(
    new URL("/profile?oura=connected", request.url)
  )
}
