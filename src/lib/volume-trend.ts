import type { SetWithMeta } from "./personal-records"

export interface WeeklyVolume {
  weekLabel: string
  volume: number
}

/**
 * Group strength sets by ISO week (Mon-starting), sum weight × reps,
 * return the last `weeks` weeks ascending so a chart renders left-to-right.
 */
export function buildWeeklyVolumeTrend(
  sets: SetWithMeta[],
  weeks: number,
  now: Date = new Date()
): WeeklyVolume[] {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const currentMonday = new Date(today)
  currentMonday.setDate(today.getDate() + mondayOffset)

  const buckets: { weekStart: Date; weekLabel: string; volume: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(currentMonday)
    ws.setDate(currentMonday.getDate() - i * 7)
    buckets.push({
      weekStart: ws,
      weekLabel: `${ws.getMonth() + 1}/${ws.getDate()}`,
      volume: 0,
    })
  }
  const earliest = buckets[0].weekStart

  for (const s of sets) {
    if (s.weight == null || s.reps == null) continue
    const ts = new Date(s.startedAt)
    if (Number.isNaN(ts.getTime()) || ts < earliest) continue
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (ts >= buckets[i].weekStart) {
        buckets[i].volume += s.weight * s.reps
        break
      }
    }
  }

  return buckets.map(({ weekLabel, volume }) => ({ weekLabel, volume }))
}

/**
 * Suggest a deload week when the last 4 *complete* weeks have each
 * climbed at least 5% over the prior week. The current week is the
 * partial in-progress week and is excluded.
 *
 * Returns the percentage climb across the 4-week window when triggered,
 * or null when no deload is warranted.
 */
export function shouldSuggestDeload(
  volumes: number[]
): { climbPercent: number } | null {
  // Need the current partial week + at least 4 complete weeks before it.
  if (volumes.length < 5) return null
  const lastFour = volumes.slice(-5, -1)
  if (lastFour.some((v) => v <= 0)) return null
  for (let i = 1; i < lastFour.length; i++) {
    if (lastFour[i] < lastFour[i - 1] * 1.05) return null
  }
  const climbPercent = Math.round(
    ((lastFour[lastFour.length - 1] - lastFour[0]) / lastFour[0]) * 100
  )
  return { climbPercent }
}
