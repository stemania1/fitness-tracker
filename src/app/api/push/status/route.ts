import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Why push is or isn't reaching this user, answerable from inside the app.
 *
 * The scheduled sender silently skips anyone whose `user_profiles.timezone` is
 * null — it can't derive their local hour, so quiet hours and time-gating
 * would be meaningless. That skip left no trace the user could see: the "send
 * test notification" button kept reporting success, because that path needs no
 * timezone, while no scheduled reminder ever arrived. Diagnosing it meant
 * reading Vercel's cron logs.
 *
 * Uses the caller's session and RLS, so it can only ever describe their own
 * setup. Returns no subscription contents — just whether the pieces exist.
 */
export async function GET() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("timezone, last_push_sent_on")
    .eq("id", user.id)
    .single()

  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  const subscriptions = count ?? 0
  const timezone = profile?.timezone ?? null

  return NextResponse.json({
    subscriptions,
    timezone,
    lastPushSentOn: profile?.last_push_sent_on ?? null,
    // The single sentence that explains the current state.
    verdict:
      subscriptions === 0
        ? "No device is subscribed — turn Push notifications on above."
        : !timezone
          ? "No timezone on file, so scheduled reminders are skipped. Reopening the app should fix it."
          : "Set up correctly — subscribed with a timezone on file.",
    ok: subscriptions > 0 && !!timezone,
  })
}
