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

export interface DeloadSuggestion {
  /** Percentage volume climb across the window that triggered this. */
  climbPercent: number
  /** Number of complete climbing weeks in the window (3 or 4). */
  weeks: number
  /** True when low recovery (readiness < 70) shortened the window. */
  lowReadiness: boolean
}

/**
 * Suggest a deload week when recent *complete* weeks have each climbed
 * at least 5% over the prior week. The current week is the partial
 * in-progress week and is excluded.
 *
 * The default window is 4 weeks. When the user's Oura readiness is low
 * (< 70), rising volume is already outpacing recovery, so 3 climbing
 * weeks are enough to suggest backing off.
 *
 * Returns the climb details when triggered, or null when no deload is
 * warranted.
 */
export function shouldSuggestDeload(
  volumes: number[],
  recentReadiness?: number | null
): DeloadSuggestion | null {
  const lowReadiness = recentReadiness != null && recentReadiness < 70
  const windowWeeks = lowReadiness ? 3 : 4

  // Need the current partial week + the complete window before it.
  if (volumes.length < windowWeeks + 1) return null
  const window = volumes.slice(-(windowWeeks + 1), -1)
  if (window.some((v) => v <= 0)) return null
  for (let i = 1; i < window.length; i++) {
    if (window[i] < window[i - 1] * 1.05) return null
  }
  const climbPercent = Math.round(
    ((window[window.length - 1] - window[0]) / window[0]) * 100
  )
  return { climbPercent, weeks: windowWeeks, lowReadiness }
}
