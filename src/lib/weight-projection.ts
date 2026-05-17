/**
 * Weight-goal projection.
 *
 * Given a series of weight logs, fit a least-squares line and project when
 * the user will reach their target weight at the current rate of change.
 */

export interface WeightPoint {
  /** Days since some reference point. */
  day: number
  /** Weight in lbs. */
  weight: number
}

export interface LinearFit {
  /** Slope in lbs per day. Negative = losing weight. */
  slope: number
  /** Intercept (weight at day 0). */
  intercept: number
}

/** Standard least-squares fit. Returns null when there isn't enough data
 *  (fewer than 2 distinct day values). */
export function linearRegression(points: WeightPoint[]): LinearFit | null {
  if (points.length < 2) return null
  const uniqueDays = new Set(points.map((p) => p.day))
  if (uniqueDays.size < 2) return null

  const n = points.length
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumXY = 0
  for (const p of points) {
    sumX += p.day
    sumY += p.weight
    sumXX += p.day * p.day
    sumXY += p.day * p.weight
  }
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

export interface WeightProjection {
  /** Slope expressed as lbs per week (more readable than per day). */
  lbsPerWeek: number
  /** Number of days from now until the target is reached. */
  daysToTarget: number
  /** ISO date string for the projected target date. */
  projectedDate: string
  /** Whether the user is moving toward their target (vs. away). */
  onTrack: boolean
}

/**
 * Project when the user will hit `targetWeight` given a linear fit of recent
 * weight logs. Returns null when the projection isn't meaningful — too
 * little data, flat trend, or moving away from the target.
 *
 * @param currentWeight  Most recent weight measurement
 * @param targetWeight   Goal weight
 * @param fit            Linear fit returned by linearRegression
 * @param now            Override for tests
 */
export function projectWeightDate(
  currentWeight: number,
  targetWeight: number,
  fit: LinearFit | null,
  now: Date = new Date()
): WeightProjection | null {
  if (!fit) return null
  if (currentWeight === targetWeight) return null
  // Direction we need to move: negative if losing, positive if gaining.
  const needed = targetWeight - currentWeight
  // Need slope sign to match needed sign.
  if (
    (needed < 0 && fit.slope >= -0.001) ||
    (needed > 0 && fit.slope <= 0.001)
  ) {
    return { lbsPerWeek: fit.slope * 7, daysToTarget: 0, projectedDate: "", onTrack: false }
  }
  const daysToTarget = needed / fit.slope
  if (!Number.isFinite(daysToTarget) || daysToTarget < 0) {
    return { lbsPerWeek: fit.slope * 7, daysToTarget: 0, projectedDate: "", onTrack: false }
  }
  const projected = new Date(now)
  projected.setDate(projected.getDate() + Math.round(daysToTarget))
  return {
    lbsPerWeek: fit.slope * 7,
    daysToTarget: Math.round(daysToTarget),
    projectedDate: projected.toISOString().slice(0, 10),
    onTrack: true,
  }
}

/** Convert {date, weight}[] logs into the WeightPoint[] shape expected by
 *  linearRegression. Day numbers are days-since-epoch so they're stable
 *  across calls. */
export function logsToPoints(
  logs: Array<{ logged_at: string; weight: number }>
): WeightPoint[] {
  return logs
    .filter((l) => l.weight > 0)
    .map((l) => {
      const d = new Date(l.logged_at)
      return {
        day: Math.floor(d.getTime() / (24 * 60 * 60 * 1000)),
        weight: l.weight,
      }
    })
}
