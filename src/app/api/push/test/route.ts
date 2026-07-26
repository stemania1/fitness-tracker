import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import webpush from "web-push"

export const runtime = "nodejs"

/**
 * Send an immediate test push to the signed-in user's own devices, bypassing
 * the cron's gates (quiet hours, once-per-day, an actual reminder existing).
 * A one-tap end-to-end check that VAPID keys, the service worker, and delivery
 * all work. Uses the caller's session + RLS, so it can only ever push to the
 * user's own subscriptions.
 */
export async function POST() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject =
    process.env.VAPID_SUBJECT || "mailto:support@craigfamilywebsite.com"
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json(
      { error: "Push isn't configured yet (missing VAPID keys)." },
      { status: 500 }
    )
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json(
      { error: "No device is subscribed yet — enable push above first." },
      { status: 400 }
    )
  }

  const payload = JSON.stringify({
    title: "CraigFitness",
    body: "Test notification — push is working! 🎉",
    url: "/dashboard",
  })

  let sent = 0
  let pruned = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id)
        pruned++
      }
    }
  }

  if (sent === 0) {
    return NextResponse.json(
      {
        error:
          "Couldn't reach your device — the subscription may be stale. Toggle push off and on, then retry.",
        pruned,
      },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, sent, pruned })
}
