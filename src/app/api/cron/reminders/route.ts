import { NextResponse } from "next/server"
import webpush from "web-push"
import { createServiceClient } from "@/lib/supabase/service"
import { dueReminderPush } from "@/lib/push/due"
import {
  localHourInZone,
  localDateInZone,
  daysBetweenLocalDates,
} from "@/lib/push/timezone"
import type { ReminderContext } from "@/lib/reminders"

export const runtime = "nodejs"
// Never cache — this is a scheduled side-effecting job.
export const dynamic = "force-dynamic"

/**
 * Scheduled reminder sender (Vercel Cron, hourly).
 *
 * For every user with a push subscription, it reasons in the user's local
 * time (via their stored timezone), builds the same reminder context the
 * dashboard uses, and — respecting their preferences, quiet hours, and a
 * once-per-local-day guard — sends at most one push. Dead subscriptions
 * (404/410) are pruned.
 *
 * Auth: Vercel injects `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET
 * is set. Requests without it are rejected.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:support@craigfamilywebsite.com"
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 })
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const db = createServiceClient()
  const now = new Date()

  // Everyone with at least one subscription.
  const { data: subs, error: subErr } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 })
  }

  const byUser = new Map<string, typeof subs>()
  for (const s of subs ?? []) {
    const list = byUser.get(s.user_id) ?? []
    list.push(s)
    byUser.set(s.user_id, list)
  }

  let sent = 0
  let pruned = 0

  for (const [userId, userSubs] of byUser) {
    const { data: profile } = await db
      .from("user_profiles")
      .select("reminder_settings, timezone, last_push_sent_on")
      .eq("id", userId)
      .single()
    if (!profile?.timezone) continue // can't localize without a timezone

    const hour = localHourInZone(now, profile.timezone)
    const localDate = localDateInZone(now, profile.timezone)
    if (hour == null || localDate == null) continue

    const ctx = await gatherContext(db, userId, profile.timezone, localDate, hour)
    const notification = dueReminderPush({
      reminderSettingsRaw: profile.reminder_settings,
      ctx,
      localDate,
      lastPushSentOn: profile.last_push_sent_on,
    })
    if (!notification) continue

    let deliveredToUser = false
    for (const sub of userSubs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(notification)
        )
        deliveredToUser = true
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id)
          pruned++
        }
      }
    }

    // Record the send so the hourly cron won't nudge again today.
    if (deliveredToUser) {
      await db
        .from("user_profiles")
        .update({ last_push_sent_on: localDate })
        .eq("id", userId)
    }
  }

  return NextResponse.json({ ok: true, sent, pruned, users: byUser.size })
}

/** Build the reminder context for a user, reasoning in their local day. */
async function gatherContext(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  timezone: string,
  localDate: string,
  hour: number
): Promise<ReminderContext> {
  const localDateOf = (iso: string) =>
    localDateInZone(new Date(iso), timezone)

  // Most recent workout.
  const { data: lastWorkout } = await db
    .from("workout_logs")
    .select("started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
  const lastWorkoutDate = lastWorkout?.[0]
    ? localDateOf(lastWorkout[0].started_at)
    : null
  const daysSinceLastWorkout = lastWorkoutDate
    ? daysBetweenLocalDates(lastWorkoutDate, localDate)
    : null

  // Most recent weigh-in.
  const { data: lastWeight } = await db
    .from("weight_logs")
    .select("logged_at")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .limit(1)
  const lastWeightDate = lastWeight?.[0]
    ? localDateOf(lastWeight[0].logged_at)
    : null
  const daysSinceLastWeighIn = lastWeightDate
    ? daysBetweenLocalDates(lastWeightDate, localDate)
    : null

  // Energy check-in today (logged_on is already a local date).
  const { data: energy } = await db
    .from("energy_checkins")
    .select("id")
    .eq("user_id", userId)
    .eq("logged_on", localDate)
    .limit(1)

  // Meals today — pull a 48h window and count local-day matches.
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: meals } = await db
    .from("food_logs")
    .select("logged_at")
    .eq("user_id", userId)
    .gte("logged_at", since)
  const mealsLoggedToday = (meals ?? []).filter(
    (m) => localDateOf(m.logged_at) === localDate
  ).length

  return {
    hour,
    mealsLoggedToday,
    workedOutToday: daysSinceLastWorkout === 0,
    daysSinceLastWorkout,
    energyCheckedInToday: (energy?.length ?? 0) > 0,
    daysSinceLastWeighIn,
  }
}
