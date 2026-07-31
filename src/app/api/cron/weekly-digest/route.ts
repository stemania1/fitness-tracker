import { NextResponse } from "next/server"
import webpush from "web-push"
import { createServiceClient } from "@/lib/supabase/service"
import { buildWeeklyDigest, type DigestInput } from "@/lib/weekly-digest"
import {
  weeklyDigestNotification,
  isDigestTime,
} from "@/lib/push/weekly-digest-push"
import {
  localHourInZone,
  localDateInZone,
  localWeekdayInZone,
} from "@/lib/push/timezone"
import {
  estimateAdaptiveTdee,
  recommendedRate,
  targetIntakeForRate,
  type DailyIntake,
} from "@/lib/adaptive-tdee"
import type { WeightPoint } from "@/lib/weight-projection"
import { buildOuraTrend, type OuraDailyPoint } from "@/lib/oura-trends"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DAY = 86_400_000

/**
 * Weekly coach digest push (Vercel Cron, hourly on Sun + Mon UTC).
 *
 * Runs every hour because it must catch Sunday 18:00 in every timezone, and
 * sends to a user only when it is Sunday 18:00 for THEM. The schedule is
 * scoped to Sunday and Monday UTC because that's the whole span it can fall
 * in: Sunday 18:00 at UTC+14 is Sunday 04:00 UTC, and at UTC-12 it's Monday
 * 06:00 UTC. Every other hour of the week would be a guaranteed no-op.
 *
 * `last_digest_sent_on` de-dupes: the hourly job can hit the same local hour
 * twice on a daylight-saving fall-back Sunday, when 18:00 local happens twice.
 *
 * Deliberately quieter than the dashboard card it mirrors. The card shows the
 * full digest whenever the user looks; this only interrupts when there's
 * something to act on, so a week where everything is on track sends nothing.
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
  const vapidSubject =
    process.env.VAPID_SUBJECT || "mailto:support@craigfamilywebsite.com"
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 })
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const db = createServiceClient()
  const now = new Date()

  const { data: subs, error: subErr } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 })
  }

  const byUser = new Map<string, NonNullable<typeof subs>>()
  for (const s of subs ?? []) {
    const list = byUser.get(s.user_id) ?? []
    list.push(s)
    byUser.set(s.user_id, list)
  }

  let sent = 0
  let pruned = 0
  // Why users were skipped, mirroring the reminders cron: hitting this
  // endpoint should diagnose "no digest arrived" rather than report a bare ok.
  const skipped = { noTimezone: 0, notDigestTime: 0, alreadySent: 0, nothingToSay: 0 }

  for (const [userId, userSubs] of byUser) {
    const { data: profile } = await db
      .from("user_profiles")
      .select("timezone, last_digest_sent_on, current_weight, target_weight")
      .eq("id", userId)
      .single()

    const timezone = profile?.timezone ?? null
    if (!timezone) {
      skipped.noTimezone++
      continue
    }

    const weekday = localWeekdayInZone(now, timezone)
    const hour = localHourInZone(now, timezone)
    const localDate = localDateInZone(now, timezone)
    if (!isDigestTime(weekday, hour) || !localDate) {
      skipped.notDigestTime++
      continue
    }
    if (profile?.last_digest_sent_on === localDate) {
      skipped.alreadySent++
      continue
    }

    const input = await gatherDigestInput(db, userId, timezone, now, {
      currentWeight: profile?.current_weight ?? null,
      targetWeight: profile?.target_weight ?? null,
    })
    const notification = weeklyDigestNotification(buildWeeklyDigest(input))
    if (!notification) {
      skipped.nothingToSay++
      // Still record the date: a quiet week shouldn't leave the door open for
      // a later hour in the same local day to try again.
      await db
        .from("user_profiles")
        .update({ last_digest_sent_on: localDate })
        .eq("id", userId)
      continue
    }

    let delivered = false
    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...notification, tag: "craigfitness-weekly-digest" })
        )
        delivered = true
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id)
          pruned++
        }
      }
    }

    if (delivered) {
      await db
        .from("user_profiles")
        .update({ last_digest_sent_on: localDate })
        .eq("id", userId)
    }
  }

  return NextResponse.json({ ok: true, sent, pruned, users: byUser.size, skipped })
}

/**
 * Days-since-epoch for a timestamp in the user's timezone.
 *
 * `epochDay` from lib/dates buckets by the *server's* local day, which on
 * Vercel is UTC — that would file a user's 8pm dinner under the next day and
 * bias the daily-intake buckets the TDEE fit runs on. Going through the
 * user's zone first keeps a "day" the same day they lived it.
 */
function epochDayInZone(iso: string, timeZone: string): number | null {
  const date = localDateInZone(new Date(iso), timeZone)
  if (!date) return null
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY)
}

/**
 * Build the digest input for one user — the server-side mirror of
 * WeeklyDigestCard's query, over the same windows and the same pure helpers,
 * so the push and the card the user taps through to can't disagree.
 */
async function gatherDigestInput(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  timezone: string,
  now: Date,
  weight: { currentWeight: number | null; targetWeight: number | null }
): Promise<DigestInput> {
  const ms = now.getTime()
  const since70Iso = new Date(ms - 70 * DAY).toISOString()
  const since21Iso = new Date(ms - 21 * DAY).toISOString()
  const d7 = localDateInZone(new Date(ms - 7 * DAY), timezone)
  const d14 = localDateInZone(new Date(ms - 14 * DAY), timezone)
  const d21 = localDateInZone(new Date(ms - 21 * DAY), timezone)

  const [weightRes, foodRes, workoutRes, energyRes, ouraRes] = await Promise.all([
    db
      .from("weight_logs")
      .select("weight, logged_at")
      .eq("user_id", userId)
      .gte("logged_at", since70Iso),
    db
      .from("food_logs")
      .select("calories, logged_at")
      .eq("user_id", userId)
      .gte("logged_at", since70Iso),
    db
      .from("workout_logs")
      .select("started_at")
      .eq("user_id", userId)
      .gte("started_at", since21Iso),
    db
      .from("energy_checkins")
      .select("level, logged_on")
      .eq("user_id", userId)
      .gte("logged_on", d14 ?? ""),
    db
      .from("oura_daily")
      .select("day, sleep_score, sleep_minutes, readiness_score")
      .eq("user_id", userId)
      .gte("day", d21 ?? ""),
  ])

  // Workouts — this week (last 7d) vs the 7 before.
  const wThisStart = ms - 7 * DAY
  const wLastStart = ms - 14 * DAY
  let workoutsThisWeek = 0
  let workoutsLastWeek = 0
  for (const w of workoutRes.data ?? []) {
    const t = new Date(w.started_at).getTime()
    if (t >= wThisStart) workoutsThisWeek++
    else if (t >= wLastStart) workoutsLastWeek++
  }

  // Adaptive TDEE from weigh-ins + daily intake.
  const weighIns: WeightPoint[] = []
  for (const w of weightRes.data ?? []) {
    const day = epochDayInZone(w.logged_at, timezone)
    if (day != null) weighIns.push({ day, weight: w.weight })
  }
  const byDay = new Map<number, number>()
  for (const f of foodRes.data ?? []) {
    const day = epochDayInZone(f.logged_at, timezone)
    if (day == null) continue
    byDay.set(day, (byDay.get(day) ?? 0) + (f.calories ?? 0))
  }
  const intake: DailyIntake[] = [...byDay.entries()].map(([day, calories]) => ({
    day,
    calories,
  }))
  const est = estimateAdaptiveTdee(weighIns, intake)
  const targetRate =
    weight.currentWeight != null
      ? recommendedRate(weight.currentWeight, weight.targetWeight)
      : 0
  const targetIntake =
    est.tdee != null ? targetIntakeForRate(est.tdee, targetRate) : null

  // Energy this week vs last.
  const eThis: number[] = []
  const eLast: number[] = []
  for (const e of energyRes.data ?? []) {
    if (d7 && e.logged_on >= d7) eThis.push(e.level)
    else if (d14 && e.logged_on >= d14) eLast.push(e.level)
  }
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null

  // Sleep.
  const ouraPoints: OuraDailyPoint[] = (ouraRes.data ?? []).map((r) => ({
    day: r.day,
    sleepScore: r.sleep_score,
    sleepMinutes: r.sleep_minutes,
    readinessScore: r.readiness_score,
  }))
  const sleepTrend = buildOuraTrend(ouraPoints, "sleepHours")

  return {
    workoutsThisWeek,
    workoutsLastWeek,
    tdee: est.tdee,
    weightTrendLbsPerWeek: est.lbsPerWeek,
    targetRateLbsPerWeek: targetRate,
    avgIntake: est.avgIntake,
    targetIntake,
    avgEnergyThisWeek: avg(eThis),
    avgEnergyLastWeek: avg(eLast),
    avgSleepHours: sleepTrend.avg7,
    sleepDeltaHours: sleepTrend.delta,
    topEnergyInsight: null,
  }
}
