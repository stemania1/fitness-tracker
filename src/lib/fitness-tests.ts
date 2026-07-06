/**
 * Fitness field-test helpers: Cooper-test VO2 Max estimation and the
 * merged Cooper + Oura series behind the dashboard VO2 Max trend chart.
 */

export type FitnessTestType = "cooper_run" | "pullup_max"

/** The columns of a fitness_tests row the trend logic needs. */
export interface FitnessTestEntry {
  test_type: FitnessTestType
  /** cooper_run: meters covered in 12 min; pullup_max: strict reps. */
  result: number
  /** YYYY-MM-DD */
  tested_at: string
}

/** A single day's Oura VO2 Max estimate. */
export interface OuraVo2Sample {
  /** YYYY-MM-DD */
  day: string
  vo2_max: number
}

/**
 * Estimate VO2 Max (ml/kg/min) from a Cooper 12-minute test.
 * Standard Cooper formula: (distance_m − 504.9) / 44.73.
 * Returns null for distances at or below the formula's zero point —
 * those indicate a mis-entered result, not a plausible test.
 */
export function cooperVo2Max(distanceMeters: number): number | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 504.9) return null
  return Math.round(((distanceMeters - 504.9) / 44.73) * 10) / 10
}

export interface Vo2TrendPoint {
  /** YYYY-MM-DD */
  day: string
  /** Cooper-test estimate, when a test was logged that day. */
  cooper?: number
  /** Oura's daily estimate, when the ring produced one. */
  oura?: number
}

/**
 * Merge Cooper-test results and Oura daily estimates into a single
 * date-sorted series. Days appearing in both sources yield one point with
 * both values. Non-Cooper tests and unusable Cooper distances are skipped.
 */
export function buildVo2Trend(
  tests: FitnessTestEntry[],
  ouraSamples: OuraVo2Sample[]
): Vo2TrendPoint[] {
  const byDay = new Map<string, Vo2TrendPoint>()

  const point = (day: string): Vo2TrendPoint => {
    let p = byDay.get(day)
    if (!p) {
      p = { day }
      byDay.set(day, p)
    }
    return p
  }

  for (const sample of ouraSamples) {
    if (sample.vo2_max != null) point(sample.day).oura = sample.vo2_max
  }

  for (const test of tests) {
    if (test.test_type !== "cooper_run") continue
    const vo2 = cooperVo2Max(test.result)
    if (vo2 != null) point(test.tested_at).cooper = vo2
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

/**
 * Most recent pull-up max test, for the stat shown beside the trend chart.
 */
export function latestPullupMax(
  tests: FitnessTestEntry[]
): { reps: number; tested_at: string } | null {
  let latest: { reps: number; tested_at: string } | null = null
  for (const test of tests) {
    if (test.test_type !== "pullup_max") continue
    if (!latest || test.tested_at > latest.tested_at) {
      latest = { reps: test.result, tested_at: test.tested_at }
    }
  }
  return latest
}
