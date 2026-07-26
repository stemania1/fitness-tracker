/**
 * Creatine daily-streak logic. Consistency is what makes creatine work, so the
 * card celebrates a run of consecutive days taken. Pure and date-string based
 * (YYYY-MM-DD local dates) so it's timezone-safe and unit-tested.
 */

/** Shift a YYYY-MM-DD date string by `days` (can be negative). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/**
 * Current streak of consecutive days taken, ending at `today`. If today isn't
 * logged yet the streak counts back from yesterday, so an as-yet-unlogged day
 * doesn't read as a broken streak — taking it today extends the run.
 */
export function currentStreak(takenDates: Iterable<string>, today: string): number {
  const set = takenDates instanceof Set ? takenDates : new Set(takenDates)
  // Anchor at today if taken, else yesterday.
  let cursor = set.has(today) ? today : shiftDate(today, -1)
  let streak = 0
  while (set.has(cursor)) {
    streak++
    cursor = shiftDate(cursor, -1)
  }
  return streak
}
