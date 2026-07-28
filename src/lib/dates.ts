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
