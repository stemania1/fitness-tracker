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
import { payloadSource } from "@/lib/push/payload-source"
import { DEFAULT_STEP_GOAL } from "@/lib/daily-movement"

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
  const source = payloadSource()

  // Everyone with at least one subscription.
  const { data: subs, error: subErr } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
  if (subErr) {
    // Log before returning. This is the single most consequential failure the
    // job has — a rejected key or an unreachable database means NOBODY is
    // reminded — and it used to return here without writing a line, while the
    // success path logged in full. So the one outcome worth alerting on was
    // the one that left no trace: Vercel discards the response body, and a
    // job that reached no one looked exactly like a quiet day.
    console.log(
      JSON.stringify({
        job: "cron/reminders",
        at: now.toISOString(),
        source,
        fatal: `push_subscriptions: ${subErr.message}`,
      })
    )
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
    claimLost: 0,
    // Claimed the day and then reached nobody — the user gets nothing until
    // tomorrow, so these must not be counted as sends.
    sendFailed: 0,
    subscriptionsGone: 0,
  }
  // Messages from failed context queries, so a run that fabricated-then-
  // suppressed reminders is visible in the response (bounded to stay small).
  const contextErrors: string[] = []
  // Push-service failures that aren't a dead subscription (429, 5xx, ...).
  // Swallowing these made a run that reached nobody look identical to a run
  // with nothing to say.
  const sendErrors: string[] = []
  // One line per user explaining what this run decided and why. Vercel Cron
  // discards the response body, so the response alone documented nothing —
  // this is what actually lands in the runtime logs.
  const decisions: UserDecision[] = []

  for (const [userId, userSubs] of byUser) {
    const { data: profile } = await db
      .from("user_profiles")
      .select(
        "reminder_settings, timezone, last_push_sent_on, daily_step_goal"
      )
      .eq("id", userId)
      .single()
    const decision: UserDecision = { user: userId.slice(0, 8), subs: userSubs?.length ?? 0 }
    decisions.push(decision)
    if (!profile) {
      skipped.noProfile++
      decision.outcome = "noProfile"
      continue
    }
    // Without a timezone we can't work out the user's local hour, so quiet
    // hours and time-gating would be meaningless. The client re-sends its
    // timezone on every load (see refreshPushSubscription), so a null here
    // means that user hasn't opened the app since this was added.
    if (!profile.timezone) {
      skipped.noTimezone++
      decision.outcome = "noTimezone"
      continue
    }

    const hour = localHourInZone(now, profile.timezone)
    const localDate = localDateInZone(now, profile.timezone)
    if (hour == null || localDate == null) {
      skipped.badTimezone++
      decision.outcome = "badTimezone"
      decision.tz = profile.timezone
      continue
    }
    decision.tz = profile.timezone
    decision.hour = hour
    decision.localDate = localDate
    decision.lastPushSentOn = profile.last_push_sent_on

    const built = await gatherContext(
      db,
      userId,
      profile.timezone,
      localDate,
      hour,
      profile.daily_step_goal ?? DEFAULT_STEP_GOAL
    )
    if (contextErrors.length < 20) contextErrors.push(...built.errors)
    const notification = dueReminderPush({
      reminderSettingsRaw: profile.reminder_settings,
      ctx: built.ctx,
      localDate,
      lastPushSentOn: profile.last_push_sent_on,
    })
    if (!notification) {
      skipped.notDue++
      decision.outcome =
        profile.last_push_sent_on === localDate ? "alreadySentToday" : "nothingDue"
      continue
    }

    // Claim the day BEFORE sending, and only if it isn't already claimed.
    //
    // Two things this has to survive. A failed write must not leave the guard
    // unset (the hourly cron would then re-nudge all day — spamming is worse
    // than losing one day's nudge). And two overlapping invocations must not
    // both send: the guard is read at the top of the loop, several queries
    // before this write, so a plain unconditional update lets both win. The
    // `neq` filter makes the claim the point of serialization, and reading the
    // stored value back confirms it actually landed — an update that reports
    // no error but doesn't stick is exactly what turns this job into an hourly
    // repeat, and it can't be distinguished from success any other way.
    const { data: claimed, error: claimErr } = await db
      .from("user_profiles")
      .update({ last_push_sent_on: localDate })
      .eq("id", userId)
      .or(`last_push_sent_on.is.null,last_push_sent_on.neq.${localDate}`)
      .select("last_push_sent_on")
    if (claimErr) {
      skipped.claimFailed++
      decision.outcome = "claimFailed"
      decision.error = claimErr.message
      continue
    }
    if (!claimed || claimed.length === 0) {
      // Someone else claimed today between our read and this write, or the
      // write matched no row at all. Either way the day is spoken for.
      skipped.claimLost++
      decision.outcome = "claimLost"
      continue
    }
    if (claimed[0].last_push_sent_on !== localDate) {
      // The write returned a row but not our date. Don't send: an unstuck
      // guard means every later run this day would send again.
      skipped.claimFailed++
      decision.outcome = "claimFailed"
      decision.error = `claim did not stick (stored ${claimed[0].last_push_sent_on})`
      continue
    }

    decision.body = notification.body
    let deliveredHere = 0
    let prunedHere = 0
    let failedHere = 0
    for (const sub of userSubs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...notification, source })
        )
        sent++
        deliveredHere++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id)
          pruned++
          prunedHere++
        } else {
          failedHere++
          if (sendErrors.length < 20) {
            sendErrors.push(`${status ?? "?"}: ${(err as Error).message ?? "unknown"}`)
          }
        }
      }
    }
    decision.delivered = deliveredHere
    decision.pruned = prunedHere

    // A day that reached nobody is not a day that was sent. The outcome used
    // to be written before this loop ran, so a user whose every push failed
    // was recorded as "sent" — and the guard above is already claimed, so
    // they get nothing until tomorrow. The one line in the log that says what
    // happened to this user asserted the opposite of what happened.
    //
    // The two ways it reaches nobody need different responses, so they get
    // different outcomes: a push service that errored is worth retrying and
    // probably transient, while every subscription being gone means the
    // device must re-subscribe and no amount of retrying will help.
    if (deliveredHere > 0) {
      decision.outcome = "sent"
    } else if (failedHere === 0 && prunedHere > 0) {
      skipped.subscriptionsGone++
      decision.outcome = "subscriptionsGone"
    } else {
      skipped.sendFailed++
      decision.outcome = "sendFailed"
    }
  }

  const summary = {
    job: "cron/reminders",
    at: now.toISOString(),
    // Which database this run read, so a log line can be matched against the
    // origin stamped into the payloads it sent.
    source,
    users: byUser.size,
    sent,
    pruned,
    skipped,
    contextErrors,
    sendErrors,
    decisions,
  }
  // Vercel Cron throws the response body away, so the diagnostics below only
  // exist if we write them to the log. Without this the job's behavior can
  // only be inferred from whether a phone buzzed.
  console.log(JSON.stringify(summary))

  return NextResponse.json({ ok: true, ...summary })
}

/** What this run decided for one user, and the inputs behind that decision. */
interface UserDecision {
  /** Truncated user id — enough to correlate runs without logging it whole. */
  user: string
  subs: number
  tz?: string
  hour?: number
  localDate?: string
  lastPushSentOn?: string | null
  outcome?:
    | "noProfile"
    | "noTimezone"
    | "badTimezone"
    | "alreadySentToday"
    | "nothingDue"
    | "claimFailed"
    | "claimLost"
    | "sent"
    | "sendFailed"
    | "subscriptionsGone"
  /** Subscriptions the push actually reached. */
  delivered?: number
  /** Subscriptions the push service reported dead, and we deleted. */
  pruned?: number
  body?: string
  error?: string
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
  hour: number,
  stepGoal: number
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

  // Steps today, from the synced Oura history (`day` is already a local
  // date). This is the client's sync, not a live Oura read: the cron has no
  // user token to refresh. A user who hasn't opened the app today simply has
  // no row, which reads as "unknown" and suppresses the nudge — the right
  // outcome, since we genuinely don't know how much they walked.
  const steps = await db
    .from("oura_daily")
    .select("steps")
    .eq("user_id", userId)
    .eq("day", localDate)
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
    stepsToday: fallible<number | null>(
      "oura_daily",
      steps.error,
      steps.data?.[0]?.steps ?? null
    ),
    stepGoal,
  })
}
