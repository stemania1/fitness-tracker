/**
 * Turn the weekly coach digest into the one push notification that carries it.
 *
 * The dashboard card shows the full digest — three sections and up to two
 * actions. A notification has room for roughly a line, so this leads with the
 * single highest-priority action (what to actually DO) and uses the fitness
 * headline as context, because "2 workouts this week" is the number the user
 * is deciding against.
 */

import type { WeeklyDigest } from "@/lib/weekly-digest"
import type { PushNotification } from "./reminder-digest"

/** Sunday. The digest reviews the week just finished. */
export const DIGEST_WEEKDAY = 0
/** 18:00 local — evening, when the coming week is still plannable. */
export const DIGEST_HOUR = 18

/**
 * Whether it's the digest's moment in this user's local time. Both parts must
 * be non-null: without a timezone we can't tell, and guessing would nudge
 * people in the middle of their night.
 */
export function isDigestTime(
  weekday: number | null,
  hour: number | null
): boolean {
  return weekday === DIGEST_WEEKDAY && hour === DIGEST_HOUR
}

/**
 * The notification for a digest, or null when there's nothing worth sending.
 *
 * `buildWeeklyDigest` always returns at least one action, including a
 * "you're on track" filler. That reads fine inside a card the user chose to
 * look at, and reads like spam as an unprompted Sunday notification — so a
 * digest whose only action is that filler sends nothing.
 */
export function weeklyDigestNotification(
  digest: WeeklyDigest,
  builtAt: Date = new Date()
): PushNotification | null {
  const [top] = digest.actions
  if (!top) return null
  // The filler action carries the lowest priority the builder emits.
  if (top.priority <= 10) return null

  const fitness = digest.sections.find((s) => s.key === "fitness")
  const body = fitness ? `${fitness.headline} — ${top.text}` : top.text

  return {
    title: "Your week in review",
    body,
    url: "/dashboard",
    // The digest summarizes a week that has already ended, so it doesn't go
    // stale the way a reminder does — but it carries the stamp anyway, so a
    // push arriving WITHOUT one can be read as "not from this code".
    builtAt: builtAt.toISOString(),
    tag: "craigfitness-weekly-digest",
  }
}
