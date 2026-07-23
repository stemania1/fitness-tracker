/**
 * Timezone helpers for the reminder cron. The cron runs in UTC but must reason
 * in each user's local time so quiet hours and the time-gated nudges match
 * what they'd see in the app. Both helpers fall back to null on an invalid
 * timezone so a bad stored value can never throw in the sender loop.
 */

/** The user's local hour (0-23) for `now`, or null if the timezone is invalid. */
export function localHourInZone(now: Date, timeZone: string | null): number | null {
  if (!timeZone) return null
  try {
    const s = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(now)
    const h = parseInt(s, 10)
    // Intl can render midnight as "24"; normalize to 0-23.
    return Number.isFinite(h) ? h % 24 : null
  } catch {
    return null
  }
}

/** Whole days from local date `from` to `to` (both YYYY-MM-DD). */
export function daysBetweenLocalDates(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** The user's local calendar date (YYYY-MM-DD) for `now`, or null. */
export function localDateInZone(now: Date, timeZone: string | null): string | null {
  if (!timeZone) return null
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now)
  } catch {
    return null
  }
}
