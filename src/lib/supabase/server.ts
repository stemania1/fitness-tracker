import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database"
import { SUPABASE_COOKIE_OPTIONS } from "./cookie-options"

/**
 * Same reasoning as the service client: supabase-js queries through the
 * global `fetch`, which Next.js replaces with a caching one.
 *
 * It matters more here, not less. These requests are made on behalf of a
 * signed-in user and carry their token, so what a cache holds is one
 * person's data keyed on a URL that doesn't mention them. Even setting that
 * aside, every read through this client is a question about the user's
 * current state — their profile, their subscriptions, today's logs — and a
 * stale answer to those is simply wrong.
 */
function noStoreFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" })
}

export function createServerSupabaseClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      global: { fetch: noStoreFetch },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Server component - can't set cookies
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch {
            // Server component - can't set cookies
          }
        },
      },
    }
  )
}
