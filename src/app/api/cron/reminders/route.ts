import { NextResponse } from "next/server"
import webpush from "web-push"
import { createServiceClient } from "@/lib/supabase/service"
import { dueReminderPush } from "@/lib/push/due"
import { localHourInZone, localDateInZone } from "@/lib/push/timezone"
import {
  buildReminderContext,
  type BuiltReminderContext,
  type Fallible,
} from "@/lib/push/reminder-context"

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
  // Why users were skipped. Returned in the response so hitting this endpoint
  // diagnoses "no notifications" instead of reporting a bare ok:true — a user
  // with no stored timezone is skipped permanently and silently otherwise.
  const skipped = {
    noProfile: 0,
    noTimezone: 0,
    badTimezone: 0,
    notDue: 0,
    claimFailed: 0,
  }
  // Messages from failed context queries, so a run that fabricated-then-
  // suppressed reminders is visible in the response (bounded to stay small).
  const contextErrors: string[] = []

  for (const [userId, userSubs] of byUser) {
    const { data: profile } = await db
      .from("user_profiles")
      .select("reminder_settings, timezone, last_push_sent_on")
      .eq("id", userId)
      .single()
    if (!profile) {
      skipped.noProfile++
      continue
    }
    // Without a timezone we can't work out the user's local hour, so quiet
    // hours and time-gating would be meaningless. The client re-sends its
    // timezone on every load (see refreshPushSubscription), so a null here
    // means that user hasn't opened the app since this was added.
    if (!profile.timezone) {
      skipped.noTimezone++
      continue
    }

    const hour = localHourInZone(now, profile.timezone)
    const localDate = localDateInZone(now, profile.timezone)
    if (hour == null || localDate == null) {
      skipped.badTimezone++
      continue
    }

    const built = await gatherContext(db, userId, profile.timezone, localDate, hour)
    if (contextErrors.length < 20) contextErrors.push(...built.errors)
    const notification = dueReminderPush({
      reminderSettingsRaw: profile.reminder_settings,
      ctx: built.ctx,
      localDate,
      lastPushSentOn: profile.last_push_sent_on,
    })
    if (!notification) {
      skipped.notDue++
      continue
    }

    // Claim the day BEFORE sending. Recording it afterwards means a failed
    // write leaves the guard unset and the hourly cron re-nudges all day —
    // spamming is worse than the claim's downside (a send failure after a
    // successful claim just costs that day's nudge). Skip the user rather
    // than send if the claim itself fails.
    const { error: claimErr } = await db
      .from("user_profiles")
      .update({ last_push_sent_on: localDate })
      .eq("id", userId)
    if (claimErr) {
      skipped.claimFailed++
      continue
    }

    for (const sub of userSubs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(notification)
        )
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id)
          pruned++
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    pruned,
    users: byUser.size,
    skipped,
    contextErrors,
  })
}

/**
 * Build the reminder context for a user, reasoning in their local day. Each
 * query's error is carried through `Fallible` into `buildReminderContext`,
 * which suppresses the matching nudge instead of fabricating one.
 */
async function gatherContext(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  timezone: string,
  localDate: string,
  hour: number
): Promise<BuiltReminderContext> {
  const localDateOf = (iso: string) =>
    localDateInZone(new Date(iso), timezone)

  const fallible = <T,>(
    table: string,
    error: { message: string } | null,
    value: T
  ): Fallible<T> => (error ? { error: `${table}: ${error.message}` } : { value })

  // Most recent workout.
  const lastWorkout = await db
    .from("workout_logs")
    .select("started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)

  // Most recent weigh-in.
  const lastWeight = await db
    .from("weight_logs")
    .select("logged_at")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .limit(1)

  // Energy check-in today (logged_on is already a local date).
  const energy = await db
    .from("energy_checkins")
    .select("id")
    .eq("user_id", userId)
    .eq("logged_on", localDate)
    .limit(1)

  // Meals today — pull a 48h window and count local-day matches.
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const meals = await db
    .from("food_logs")
    .select("logged_at")
    .eq("user_id", userId)
    .gte("logged_at", since)

  // Creatine today (taken_on is already a local date).
  const creatine = await db
    .from("creatine_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("taken_on", localDate)
    .limit(1)

  return buildReminderContext({
    hour,
    localDate,
    lastWorkoutDate: fallible(
      "workout_logs",
      lastWorkout.error,
      lastWorkout.data?.[0] ? localDateOf(lastWorkout.data[0].started_at) : null
    ),
    lastWeighInDate: fallible(
      "weight_logs",
      lastWeight.error,
      lastWeight.data?.[0] ? localDateOf(lastWeight.data[0].logged_at) : null
    ),
    mealsLoggedToday: fallible(
      "food_logs",
      meals.error,
      (meals.data ?? []).filter((m) => localDateOf(m.logged_at) === localDate)
        .length
    ),
    energyCheckedInToday: fallible(
      "energy_checkins",
      energy.error,
      (energy.data?.length ?? 0) > 0
    ),
    creatineTakenToday: fallible(
      "creatine_logs",
      creatine.error,
      (creatine.data?.length ?? 0) > 0
    ),
  })
}
