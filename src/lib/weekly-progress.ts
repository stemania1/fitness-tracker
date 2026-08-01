/**
 * Pure helpers for the dashboard's "This Week" card: the week bucket label, the
 * consecutive-weeks streak, and the local start-of-week boundary used to scope
 * weekly queries.
 */

/** A coarse "W<n>" label for the ISO-ish week containing `dateStr`. */
export function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 +
      startOfYear.getDay() +
      1) /
      7
  )
  return `W${weekNum}`
}

/**
 * Number of consecutive most-recent weeks that each hit `targetPerWeek`
 * workouts. Weeks are bucketed by year + week label; the count walks back from
 * the latest bucket and stops at the first week below target.
 */
export function calcWeeklyStreak(
  workoutLogs: { started_at: string }[],
  targetPerWeek: number
): number {
  if (!workoutLogs.length || targetPerWeek <= 0) return 0

  const weekMap = new Map<string, number>()
  for (const log of workoutLogs) {
    const d = new Date(log.started_at)
    const yearWeek = `${d.getFullYear()}-${getWeekLabel(log.started_at)}`
    weekMap.set(yearWeek, (weekMap.get(yearWeek) ?? 0) + 1)
  }

  const sortedWeeks = [...weekMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  let streak = 0
  for (let i = sortedWeeks.length - 1; i >= 0; i--) {
    if (sortedWeeks[i][1] >= targetPerWeek) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/** ISO timestamp for the local Monday 00:00 of the week containing `now`. */
export function startOfWeekISO(now: Date = new Date()): string {
  const d = new Date(now)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * Workout counts for the current calendar week and the one before it.
 *
 * The digest previously bucketed on a rolling 7/14 days while This Week used
 * the calendar week, so the two cards showed different totals on the same
 * screen and both called it "this week". On a Saturday the rolling window
 * reached back across the previous weekend and counted those sessions twice
 * over — once as "last week" when they happened, then again as "this week".
 *
 * Calendar weeks are what the user means and what the weekly target is set
 * against, so that is the definition both cards now use.
 */
export function countWorkoutsByWeek(
  workouts: { started_at: string }[],
  now: Date = new Date()
): { thisWeek: number; lastWeek: number } {
  const thisStart = new Date(startOfWeekISO(now)).getTime()
  const lastStart = thisStart - 7 * 86_400_000
  let thisWeek = 0
  let lastWeek = 0
  for (const w of workouts) {
    const t = new Date(w.started_at).getTime()
    if (t >= thisStart) thisWeek++
    else if (t >= lastStart) lastWeek++
  }
  return { thisWeek, lastWeek }
}
