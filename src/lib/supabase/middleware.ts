import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { SUPABASE_COOKIE_OPTIONS } from "./cookie-options"

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: "", ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login (except auth pages and root)
  const isAuthPage = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/forgot-password")
  const isRootPage = request.nextUrl.pathname === "/"
  // Email-link verification routes must run for signed-out users so they can
  // establish a session from the link (signup confirmation, password recovery).
  const isCallbackPage = request.nextUrl.pathname.startsWith("/auth/callback") ||
    request.nextUrl.pathname.startsWith("/auth/confirm")

  // The reminder cron authenticates itself with CRON_SECRET (Bearer token),
  // not a user session — so it must not be bounced to /login. Vercel Cron
  // sends no session cookie, so without this the job silently 307s to login
  // and never sends a push.
  const isPublicPage = request.nextUrl.pathname.startsWith("/privacy") ||
    request.nextUrl.pathname.startsWith("/terms") ||
    request.nextUrl.pathname.startsWith("/api/auth/oura") ||
    request.nextUrl.pathname.startsWith("/api/cron")

  if (!user && !isAuthPage && !isRootPage && !isCallbackPage && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Send signed-in users straight to the dashboard instead of the marketing
  // landing page. `/` is a static page with no auth check of its own, so
  // without this an already-authenticated user lands on the marketing copy and
  // has to tap "Log In" — which just bounces through /login back to the
  // dashboard — on every launch. iOS pins an installed PWA to the URL that was
  // open when it was added to the home screen, so an icon created from `/`
  // hits this on every single launch regardless of the manifest's start_url.
  if (user && isRootPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return response
}
