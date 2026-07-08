/**
 * Estimate a VO2 Max reading's percentile rank within the user's age/sex
 * bracket, using verified FRIEND treadmill breakpoints
 * (src/data/vo2max-norms.ts). Returns null when no verified bracket
 * matches, so callers fall back to the qualitative rating.
 */

import { findNorm } from "@/data/vo2max-norms"
import type { Sex } from "@/lib/vo2max"

/**
 * Percentile (0-100, rounded) for a VO2 Max value, or null if the user's
 * bracket has no reference data. Values below/above the published range are
 * clamped to the extreme published percentiles rather than extrapolated.
 */
export function vo2MaxPercentile(
  vo2Max: number,
  age: number | null | undefined,
  sex: Sex
): number | null {
  if (!Number.isFinite(vo2Max)) return null
  const norm = findNorm(age, sex)
  if (!norm) return null

  const points = norm.breakpoints
  const first = points[0]
  const last = points[points.length - 1]

  // Clamp outside the published range — extrapolation isn't meaningful.
  if (vo2Max <= first.vo2) return first.percentile
  if (vo2Max >= last.vo2) return last.percentile

  // Linear interpolation between the two bracketing breakpoints.
  for (let i = 1; i < points.length; i++) {
    const lo = points[i - 1]
    const hi = points[i]
    if (vo2Max <= hi.vo2) {
      const frac = (vo2Max - lo.vo2) / (hi.vo2 - lo.vo2)
      return Math.round(lo.percentile + frac * (hi.percentile - lo.percentile))
    }
  }
  return last.percentile
}

/** "top 10%" / "bottom 15%" / "median" style phrasing for a percentile. */
export function percentileLabel(percentile: number): string {
  if (percentile >= 50) {
    const top = 100 - percentile
    if (top <= 0) return "top of your age group"
    return `top ${top}% for your age & sex`
  }
  return `bottom ${percentile}% for your age & sex`
}
