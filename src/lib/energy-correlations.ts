/**
 * Personal energy-driver analysis: given a history of daily energy ratings and
 * candidate daily factors (did you train, how much caffeine, high-GL meals, …),
 * surface which factors track with higher or lower energy. A simple, robust
 * high-vs-low group comparison (not a fragile single correlation coefficient):
 * split each factor into its high and low days and compare mean energy.
 *
 * Pure so it's unit-tested; the card assembles per-day observations from logs
 * that actually live in the DB (energy check-ins, workouts, meals, caffeine,
 * creatine) and feeds them in.
 */

export interface DayObservation {
  /** Outcome: that day's energy, on the 1–5 check-in scale. */
  energy: number
  /** Candidate factors. Numeric or boolean; null = not available that day. */
  factors: Record<string, number | boolean | null>
}

export interface FactorSpec {
  key: string
  /** boolean → compares true vs false; numeric → splits at the median. */
  kind: "boolean" | "numeric"
  /** Phrase describing the high group, e.g. "on days you train". */
  whenHigh: string
}

export interface EnergyInsight {
  key: string
  highMean: number
  lowMean: number
  /** Signed percent difference of high vs low group. */
  deltaPct: number
  direction: "higher" | "lower"
  highCount: number
  lowCount: number
  message: string
}

export interface AnalyzeOptions {
  /** Minimum days in each group to trust a factor. */
  minGroup?: number
  /** Minimum |percent difference| to report a factor. */
  minDeltaPct?: number
  /** Max insights returned. */
  max?: number
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Analyze which factors move energy, most impactful first. For each factor,
 * partition the days into a high and low group and compare mean energy; keep
 * only factors with enough days in each group and a meaningful difference.
 */
export function analyzeEnergyDrivers(
  days: DayObservation[],
  specs: FactorSpec[],
  opts: AnalyzeOptions = {}
): EnergyInsight[] {
  const minGroup = opts.minGroup ?? 4
  const minDeltaPct = opts.minDeltaPct ?? 8
  const max = opts.max ?? 4

  const insights: EnergyInsight[] = []

  for (const spec of specs) {
    const highEnergies: number[] = []
    const lowEnergies: number[] = []

    if (spec.kind === "boolean") {
      for (const d of days) {
        const v = d.factors[spec.key]
        if (v === true) highEnergies.push(d.energy)
        else if (v === false) lowEnergies.push(d.energy)
      }
    } else {
      const withValue = days.filter(
        (d) => typeof d.factors[spec.key] === "number"
      )
      if (withValue.length < minGroup * 2) continue
      const med = median(withValue.map((d) => d.factors[spec.key] as number))
      for (const d of withValue) {
        const v = d.factors[spec.key] as number
        if (v > med) highEnergies.push(d.energy)
        else lowEnergies.push(d.energy)
      }
    }

    if (highEnergies.length < minGroup || lowEnergies.length < minGroup) continue

    const highMean = mean(highEnergies)
    const lowMean = mean(lowEnergies)
    if (lowMean === 0) continue
    const deltaPct = Math.round(((highMean - lowMean) / lowMean) * 100)
    if (Math.abs(deltaPct) < minDeltaPct) continue

    const direction = highMean >= lowMean ? "higher" : "lower"
    const message = `Energy runs ~${Math.abs(deltaPct)}% ${direction} ${spec.whenHigh} (${highMean.toFixed(
      1
    )} vs ${lowMean.toFixed(1)} / 5).`

    insights.push({
      key: spec.key,
      highMean: Math.round(highMean * 10) / 10,
      lowMean: Math.round(lowMean * 10) / 10,
      deltaPct,
      direction,
      highCount: highEnergies.length,
      lowCount: lowEnergies.length,
      message,
    })
  }

  return insights
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, max)
}
