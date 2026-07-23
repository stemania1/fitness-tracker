import { createServerSupabaseClient } from "@/lib/supabase/server"
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

  const { error } = await supabase.from("push_subscriptions").upsert(
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

  if (typeof b.timezone === "string" && b.timezone.length > 0) {
    await supabase
      .from("user_profiles")
      .update({ timezone: b.timezone })
      .eq("id", user.id)
  }

  return NextResponse.json({ ok: true })
}
