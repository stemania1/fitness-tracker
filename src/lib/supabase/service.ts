import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/**
 * Every request this client makes, marked uncacheable.
 *
 * supabase-js issues its queries through the global `fetch`, and Next.js
 * replaces that global with a caching one. A cached read is wrong for this
 * client by construction: it exists for a scheduled job whose whole purpose
 * is to observe what is true right now.
 *
 * The failure it produces is genuinely hard to recognise. Writes go through
 * unaffected, so the database moves forward correctly and looks healthy under
 * inspection; only the reads are frozen, and they stay frozen until a deploy
 * purges the cache — so the job appears to fix itself whenever anyone ships,
 * and the evidence of what it saw is gone by the time anyone looks. It cost
 * an evening: a reminder cron read a once-per-day guard three days stale and
 * a workout table missing a session saved the previous morning, then sent an
 * hourly notification asserting both.
 *
 * `export const dynamic = "force-dynamic"` on a route is not a substitute.
 * It governs that route's rendering, not what a client constructed elsewhere
 * does with `fetch`, and it silently stops applying the moment this client is
 * used from a context that doesn't set it — a cron, a webhook, a script.
 * Pinning it here binds the guarantee to the client that needs it.
 */
function noStoreFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" })
}

/**
 * Service-role Supabase client for trusted server-only jobs (the reminder
 * cron). Bypasses RLS, so it must NEVER be imported into client code or a
 * user-facing route — only background/cron handlers that authenticate the
 * caller some other way (the CRON_SECRET).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for the service client."
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  })
}
