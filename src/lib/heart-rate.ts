/**
 * Age-based heart-rate estimation and training zones.
 *
 * Max HR uses the Tanaka formula (208 - 0.7 x age), which tracks measured
 * values better than the classic 220 - age, especially for adults over 40.
 * Tanaka, Monahan & Seals (2001), J Am Coll Cardiol.
 *
 * All of this is an estimate from population data — individual max HR can
 * vary by +/- 10-12 bpm. Zones are guidance, not medical limits.
 */

export interface HeartRateZone {
  /** Zone number, 1 (recovery) through 5 (max effort). */
  zone: 1 | 2 | 3 | 4 | 5
  name: string
  /** Inclusive lower bound in bpm. */
  minBpm: number
  /** Inclusive upper bound in bpm. */
  maxBpm: number
}

/** Sanity bounds — outside this range an "age" is almost certainly bad input. */
const MIN_AGE = 13
const MAX_AGE = 100

/**
 * Estimated maximum heart rate for a given age (Tanaka formula), rounded
 * to the nearest bpm. Returns null for missing or implausible ages.
 */
export function estimateMaxHeartRate(age: number | null | undefined): number | null {
  if (age == null || !Number.isFinite(age)) return null
  if (age < MIN_AGE || age > MAX_AGE) return null
  return Math.round(208 - 0.7 * age)
}

/** Percent-of-max boundaries for the standard 5-zone model. */
const ZONE_BOUNDS: Array<{ zone: 1 | 2 | 3 | 4 | 5; name: string; lo: number; hi: number }> = [
  { zone: 1, name: "Recovery", lo: 0.5, hi: 0.6 },
  { zone: 2, name: "Aerobic base", lo: 0.6, hi: 0.7 },
  { zone: 3, name: "Tempo", lo: 0.7, hi: 0.8 },
  { zone: 4, name: "Threshold", lo: 0.8, hi: 0.9 },
  { zone: 5, name: "Max effort", lo: 0.9, hi: 1.0 },
]

/**
 * Five training zones (50-100% of estimated max HR) for a given age.
 * Returns null when max HR can't be estimated.
 */
export function heartRateZones(age: number | null | undefined): HeartRateZone[] | null {
  const maxHr = estimateMaxHeartRate(age)
  if (maxHr == null) return null
  return ZONE_BOUNDS.map(({ zone, name, lo, hi }) => ({
    zone,
    name,
    minBpm: Math.round(maxHr * lo),
    maxBpm: Math.round(maxHr * hi),
  }))
}

/**
 * The training zone a heart-rate reading falls in for a given age.
 * Returns null when max HR can't be estimated, the bpm is invalid, or
 * the reading is below Zone 1 (i.e. resting, not training).
 * Readings above the estimated max still classify as Zone 5.
 */
export function classifyHeartRate(
  bpm: number,
  age: number | null | undefined
): HeartRateZone | null {
  const zones = heartRateZones(age)
  if (zones == null || !Number.isFinite(bpm) || bpm <= 0) return null
  if (bpm < zones[0].minBpm) return null
  return zones.find((z) => bpm <= z.maxBpm) ?? zones[zones.length - 1]
}

/**
 * The bpm range for a span of zones (e.g. zones 2-3 for a moderate day).
 * Returns null when max HR can't be estimated.
 */
export function zoneRange(
  age: number | null | undefined,
  fromZone: 1 | 2 | 3 | 4 | 5,
  toZone: 1 | 2 | 3 | 4 | 5
): { minBpm: number; maxBpm: number } | null {
  const zones = heartRateZones(age)
  if (zones == null) return null
  const from = zones[Math.min(fromZone, toZone) - 1]
  const to = zones[Math.max(fromZone, toZone) - 1]
  return { minBpm: from.minBpm, maxBpm: to.maxBpm }
}
