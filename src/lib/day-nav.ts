/**
 * Helpers for the day-navigation on the dashboard cards (swipe / arrows
 * through days). `offset` is days from today: 0 = today, +1 = tomorrow,
 * -1 = yesterday. Local-day based so "today" matches the user's clock.
 */

export interface DayWindow {
  startIso: string
  endIso: string
}

/** Local midnight `offset` days from today (0 = today). */
export function offsetDate(offset: number, base: Date = new Date()): Date {
  const d = new Date(base)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d
}

/** The `[start, end)` ISO window covering the local day at `offset`, for
 *  querying logs that fall on that calendar day. */
export function dayWindow(offset: number, base: Date = new Date()): DayWindow {
  const start = offsetDate(offset, base)
  const end = offsetDate(offset + 1, base)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

/**
 * Human label for a day offset: Today / Tomorrow / Yesterday, a weekday name
 * within the next/previous week, otherwise a short month-day date.
 */
export function dayLabel(offset: number, base: Date = new Date()): string {
  if (offset === 0) return "Today"
  if (offset === 1) return "Tomorrow"
  if (offset === -1) return "Yesterday"
  const d = offsetDate(offset, base)
  if (Math.abs(offset) < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" })
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
