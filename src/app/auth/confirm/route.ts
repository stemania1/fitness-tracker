import { type EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * Email-link verification via one-time token hash.
 *
 * Unlike the PKCE `/auth/callback?code=` flow, `verifyOtp` with a
 * `token_hash` does NOT require the `code_verifier` cookie that only
 * exists on the device where auth was initiated. That makes this route
 * safe to open on ANY device — e.g. signing up on a laptop and tapping
 * the confirmation link on a phone, or an email app's in-app browser.
 *
 * Supabase email templates should point here, e.g.
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/dashboard"

  if (tokenHash && type) {
    const supabase = createServerSupabaseClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
