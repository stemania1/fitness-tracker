/**
 * Local-day helpers, in one place.
 *
 * Almost every card reasons in *local* calendar days — "today", "the day this
 * was logged", "90 days back" — because that's the day the user experienced.
 * `toISOString()` would silently shift those by the UTC offset (an 8pm meal in
 * EDT lands on tomorrow), so these format from the local getters instead. They
 * were being reimplemented per file under four different names; this is the
 * shared version.
 */

/** Zero-pad to two digits. */
export function pad2(n: number): string {
  return n.toString().padStart(2, "0")
}

/** A Date as a local YYYY-MM-DD (never UTC-shifted). */
export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Today as a local YYYY-MM-DD. */
export function localToday(): string {
  return localDateString(new Date())
}

/** The local YYYY-MM-DD an ISO timestamp falls on. */
export function localDateOf(iso: string): string {
  return localDateString(new Date(iso))
}

/** The local YYYY-MM-DD `days` before now — for "since" query bounds. */
export function daysAgoDateString(days: number): string {
  return localDateString(new Date(Date.now() - days * 86_400_000))
}

/**
 * A stable day index (days since the epoch) for the local day a timestamp
 * falls on. Handy as a regression x-axis, where only day *spacing* matters.
 */
export function epochDay(iso: string | Date): number {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 86_400_000)
}

/**
 * Shift a YYYY-MM-DD string by `days` (may be negative). Done in UTC on
 * purpose: the input carries no time, so UTC arithmetic can't be dragged
 * across a boundary by a DST transition.
 */
export function shiftDateString(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

// ── Display formatting ──────────────────────────────────────────────────
//
// The same four date shapes were being retyped across pages and cards —
// `formatDate` alone existed in four files with three different outputs, and
// one of them hand-rolled its own day/month name arrays. These are the shapes
// the UI actually uses; nothing else should call `toLocaleDateString` directly.

/** A YYYY-MM-DD day at *local* midnight. Bare day strings parse as UTC
 *  otherwise, which renders the previous day for anyone west of Greenwich. */
export function parseLocalDay(day: string): Date {
  return new Date(`${day}T00:00:00`)
}

/** "Aug 1" — chart ticks and dense list rows. */
export function formatShortDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

/** "Fri, Aug 1" — workout history rows, where the weekday aids scanning. */
export function formatWeekdayShort(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

/** "Aug 1, 2026" — goal targets and milestones, which can be a year out. */
export function formatMediumDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** "Friday, August 1, 2026" — the workout detail page header. */
export function formatLongDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
