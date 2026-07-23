import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

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
  })
}
