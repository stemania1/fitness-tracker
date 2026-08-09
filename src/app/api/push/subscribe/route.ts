import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Persist a browser's push subscription for the signed-in user (idempotent on
 * the endpoint), and record the browser's timezone so the reminder cron can
 * reason in the user's local time.
 */
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }

  const b = body as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    timezone?: string
  }
  const sub = b.subscription
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 })
  }

  // Written with the service client, not the caller's, so the endpoint is
  // always claimed by whoever most recently subscribed on this browser.
  //
  // `endpoint` is UNIQUE, and the RLS update policy is `auth.uid() = user_id`
  // evaluated against the EXISTING row — so a user's own client cannot take
  // over a row left behind by another account. The upsert's update half was
  // silently refused and the row kept its old owner, which is worse than it
  // sounds: the reminder cron iterates whatever `user_id` sits on the
  // subscription, so the device kept receiving nudges computed from a stale
  // account's workouts and weigh-ins, and no amount of logging in fixed it.
  //
  // Safe because the caller proved two things: a valid session, and possession
  // of the endpoint (their browser produced it). Re-pointing a row is exactly
  // what "this browser now belongs to this user" means.
  const db = createServiceClient()
  const { error } = await db.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "endpoint" }
  )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // The scheduled sender skips any user with no timezone — silently and
  // permanently — so a failure here costs the user every future reminder while
  // the test-notification button keeps working. Report it instead of ignoring
  // it, and say whether a timezone is now on file.
  let timezoneSaved = false
  let timezoneError: string | null = null
  if (typeof b.timezone === "string" && b.timezone.length > 0) {
    const { error: tzError } = await supabase
      .from("user_profiles")
      .update({ timezone: b.timezone })
      .eq("id", user.id)
    timezoneSaved = !tzError
    timezoneError = tzError?.message ?? null
  }

  return NextResponse.json({ ok: true, timezoneSaved, timezoneError })
}
