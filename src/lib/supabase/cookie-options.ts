import type { CookieOptions } from "@supabase/ssr"

/**
 * Persistent cookie options for the Supabase auth cookies.
 *
 * Without an explicit `maxAge`, @supabase/ssr writes *session* cookies (no
 * expiry). iOS Safari discards those when the app/tab is closed, which forces
 * a fresh login on every visit. Setting the maximum persistent lifetime (400
 * days — the browser-enforced cap) keeps the refresh-token cookie around so
 * the session survives closing and reopening the app.
 *
 * On sign-out @supabase/ssr overrides this with an immediate expiry, so
 * logging out still clears the cookies correctly.
 */
export const SUPABASE_COOKIE_OPTIONS: CookieOptions = {
  maxAge: 400 * 24 * 60 * 60,
  sameSite: "lax",
  path: "/",
}
