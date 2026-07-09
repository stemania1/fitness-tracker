/**
 * Correlate nightly REM sleep against candidate drivers (previous-day
 * activity, stress, total sleep, readiness/HRV) from Oura history.
 *
 * This is exploratory, not causal: with a few weeks of nights and many
 * unmeasured confounders (alcohol, meals, screen time), a correlation is a
 * hypothesis, not proof. The UI labels strength honestly and shows n.
 */

/** One night's merged Oura metrics, keyed by the wake-up day (YYYY-MM-DD). */
export interface DailyMetrics {
  day: string
  /** REM sleep in minutes. */
  remMinutes: number | null
  /** REM as a fraction of total sleep (0-1). */
  remFraction: number | null
  totalSleepMinutes: number | null
  /** Seconds spent in high stress that day. */
  stressHighSeconds: number | null
  /** Previous calendar day's activity score (0-100). */
  activityScore: number | null
  /** Previous calendar day's high-intensity minutes. */
  highActivityMinutes: number | null
  readinessScore: number | null
  averageHrv: number | null
}

export type DriverKey =
  | "prevActivityScore"
  | "prevHighActivity"
  | "stress"
  | "totalSleep"
  | "readiness"
  | "hrv"

export interface DriverDef {
  key: DriverKey
  label: string
  /** Pull the predictor value for a night, or null when unavailable. */
  value: (m: DailyMetrics) => number | null
  /** Human-readable interpretation of a positive correlation with REM. */
  positiveMeans: string
}

/**
 * Predictors correlated against REM. "prev*" fields already carry the
 * previous day's value (the lag is applied when metrics are assembled), so
 * a night's REM lines up with the activity that preceded it.
 */
export const DRIVERS: DriverDef[] = [
  {
    key: "prevActivityScore",
    label: "Previous-day activity",
    value: (m) => m.activityScore,
    positiveMeans: "more active days precede higher-REM nights",
  },
  {
    key: "prevHighActivity",
    label: "Previous-day intense minutes",
    value: (m) => m.highActivityMinutes,
    positiveMeans: "harder training days precede higher-REM nights",
  },
  {
    key: "stress",
    label: "Daytime stress",
    value: (m) => m.stressHighSeconds,
    positiveMeans: "more stressful days precede higher-REM nights",
  },
  {
    key: "totalSleep",
    label: "Total sleep",
    value: (m) => m.totalSleepMinutes,
    positiveMeans: "longer nights carry more REM",
  },
  {
    key: "readiness",
    label: "Readiness",
    value: (m) => m.readinessScore,
    positiveMeans: "higher-readiness days precede higher-REM nights",
  },
  {
    key: "hrv",
    label: "HRV",
    value: (m) => m.averageHrv,
    positiveMeans: "higher-HRV nights carry more REM",
  },
]

/**
 * Pearson correlation over paired samples. Returns null when fewer than 3
 * complete pairs exist or either series has zero variance.
 */
export function pearson(
  pairs: Array<[number, number]>
): number | null {
  const n = pairs.length
  if (n < 3) return null

  let sumX = 0
  let sumY = 0
  for (const [x, y] of pairs) {
    sumX += x
    sumY += y
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let sxy = 0
  let sxx = 0
  let syy = 0
  for (const [x, y] of pairs) {
    const dx = x - meanX
    const dy = y - meanY
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return null

  const r = sxy / Math.sqrt(sxx * syy)
  // Guard against tiny floating drift outside [-1, 1].
  return Math.max(-1, Math.min(1, r))
}

export type CorrelationStrength =
  | "none"
  | "weak"
  | "moderate"
  | "strong"

/**
 * Qualitative strength of |r|. Thresholds are deliberately conservative so
 * short, noisy samples don't get oversold as meaningful.
 */
export function strengthOf(r: number): CorrelationStrength {
  const a = Math.abs(r)
  if (a < 0.2) return "none"
  if (a < 0.4) return "weak"
  if (a < 0.6) return "moderate"
  return "strong"
}

export interface DriverCorrelation {
  key: DriverKey
  label: string
  positiveMeans: string
  /** Pearson r vs REM %, or null if too few pairs / no variance. */
  r: number | null
  /** Number of complete night-pairs the correlation used. */
  n: number
  strength: CorrelationStrength
  direction: "positive" | "negative" | null
}

/**
 * Correlate every driver against REM fraction (REM % of sleep — this
 * controls for simply sleeping less). Total-sleep is the one driver where
 * we also care about the raw-minutes relationship, but fraction keeps all
 * drivers on the same footing.
 */
export function correlateDrivers(
  metrics: DailyMetrics[]
): DriverCorrelation[] {
  return DRIVERS.map((driver) => {
    const pairs: Array<[number, number]> = []
    for (const m of metrics) {
      const x = driver.value(m)
      const y = m.remFraction
      if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
        pairs.push([x, y])
      }
    }
    const r = pearson(pairs)
    return {
      key: driver.key,
      label: driver.label,
      positiveMeans: driver.positiveMeans,
      r,
      n: pairs.length,
      strength: r == null ? "none" : strengthOf(r),
      direction: r == null ? null : r >= 0 ? "positive" : "negative",
    }
  })
}

/**
 * Plain-English summary of a single correlation, honest about strength and
 * sample size.
 */
export function describeCorrelation(c: DriverCorrelation): string {
  if (c.r == null) {
    return c.n < 3
      ? `Not enough nights yet (${c.n}) to compare ${c.label.toLowerCase()}.`
      : `No usable variation in ${c.label.toLowerCase()} over ${c.n} nights.`
  }
  if (c.strength === "none") {
    return `No meaningful link with ${c.label.toLowerCase()} across ${c.n} nights (r = ${c.r.toFixed(2)}).`
  }
  const strengthCap = c.strength[0].toUpperCase() + c.strength.slice(1)
  const remEffect = c.direction === "positive" ? "more REM" : "less REM"
  return `${strengthCap} link (r = ${c.r.toFixed(2)}, ${c.n} nights): higher ${c.label.toLowerCase()} tracks with ${remEffect}.`
}
