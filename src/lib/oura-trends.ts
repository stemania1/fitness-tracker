/**
 * Trend series + week-over-week deltas from stored Oura daily history, for the
 * sleep/readiness charts. Pure so it's unit-tested; the card queries oura_daily
 * and picks which metric to plot.
 */

export interface OuraDailyPoint {
  day: string
  sleepScore: number | null
  sleepMinutes: number | null
  readinessScore: number | null
}

export type OuraMetric = "sleepHours" | "sleepScore" | "readiness"

export interface TrendPoint {
  day: string
  value: number
}

export interface MetricTrend {
  points: TrendPoint[]
  /** Mean of the most recent 7 data points, or null if none. */
  avg7: number | null
  /** Mean of the 7 data points before those. */
  avgPrev7: number | null
  /** avg7 − avgPrev7 (null unless both exist). */
  delta: number | null
}

function valueFor(row: OuraDailyPoint, metric: OuraMetric): number | null {
  if (metric === "sleepHours") {
    return row.sleepMinutes != null ? row.sleepMinutes / 60 : null
  }
  if (metric === "sleepScore") return row.sleepScore
  return row.readinessScore
}

function round(metric: OuraMetric, n: number): number {
  return metric === "sleepHours" ? Math.round(n * 10) / 10 : Math.round(n)
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

/** Build the daily series and 7-day-vs-prior-7 averages for a metric. */
export function buildOuraTrend(
  rows: OuraDailyPoint[],
  metric: OuraMetric
): MetricTrend {
  const points: TrendPoint[] = rows
    .map((r) => ({ day: r.day, value: valueFor(r, metric) }))
    .filter((p): p is TrendPoint => p.value != null)
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((p) => ({ day: p.day, value: round(metric, p.value) }))

  const last7 = points.slice(-7)
  const prev7 = points.slice(-14, -7)
  const avg7 = last7.length ? round(metric, mean(last7.map((p) => p.value))) : null
  const avgPrev7 = prev7.length
    ? round(metric, mean(prev7.map((p) => p.value)))
    : null
  const delta =
    avg7 != null && avgPrev7 != null ? round(metric, avg7 - avgPrev7) : null

  return { points, avg7, avgPrev7, delta }
}
