/**
 * Adaptive TDEE (total daily energy expenditure) — learn maintenance calories
 * empirically instead of from a formula. The weight trend is ground truth for
 * energy balance: over a window, (avg intake − TDEE) drives the weight change,
 * so TDEE = avg intake − (weight-change-per-day × 3500). It self-corrects as
 * more weigh-ins and food logs come in.
 *
 * Assumes reasonably consistent calorie logging over the window — sparse
 * logging biases avg intake (and thus the estimate) low, which is why the
 * result carries a confidence level. Pure so it's unit-tested; the card
 * aggregates weigh-ins and daily intake and feeds them in.
 */

import { linearRegression, type WeightPoint } from "./weight-projection"

/** Energy in one pound of body mass (the classic 3500 kcal/lb rule). */
export const CALORIES_PER_LB = 3500

export interface DailyIntake {
  /** Days since epoch (same basis as WeightPoint.day). */
  day: number
  /** Total calories logged that day. */
  calories: number
}

export type TdeeConfidence = "insufficient" | "low" | "medium" | "high"

export interface TdeeEstimate {
  /** Estimated maintenance calories/day; null when there isn't enough data. */
  tdee: number | null
  /** Average logged daily intake over the window; null with no intake data. */
  avgIntake: number | null
  /** Weight trend in lbs/week (negative = losing); null without a trend. */
  lbsPerWeek: number | null
  confidence: TdeeConfidence
  /** Days spanned by the weigh-ins used. */
  spanDays: number
  weighInCount: number
  intakeDayCount: number
}

function round(n: number): number {
  return Math.round(n)
}
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function classify(
  spanDays: number,
  weighInCount: number,
  intakeDayCount: number
): TdeeConfidence {
  if (spanDays < 14 || weighInCount < 3 || intakeDayCount < 7) {
    return "insufficient"
  }
  if (spanDays >= 28 && weighInCount >= 8 && intakeDayCount >= 21) return "high"
  if (spanDays >= 21 && weighInCount >= 5 && intakeDayCount >= 14) return "medium"
  return "low"
}

/**
 * Estimate maintenance calories from weigh-ins and daily intake. Returns a
 * null `tdee` (confidence "insufficient") until there's enough signal — the
 * caller shows a "still learning" state and the counts so far.
 */
export function estimateAdaptiveTdee(
  weighIns: WeightPoint[],
  intake: DailyIntake[]
): TdeeEstimate {
  const days = weighIns.map((w) => w.day)
  const spanDays = days.length ? Math.max(...days) - Math.min(...days) : 0
  const weighInCount = weighIns.length
  const intakeDayCount = intake.length
  const avgIntake = intake.length
    ? intake.reduce((s, d) => s + d.calories, 0) / intake.length
    : null

  const fit = linearRegression(weighIns)
  const lbsPerWeek = fit ? round1(fit.slope * 7) : null

  const confidence = classify(spanDays, weighInCount, intakeDayCount)
  if (confidence === "insufficient" || !fit || avgIntake == null) {
    return {
      tdee: null,
      avgIntake: avgIntake == null ? null : round(avgIntake),
      lbsPerWeek,
      confidence: "insufficient",
      spanDays,
      weighInCount,
      intakeDayCount,
    }
  }

  // TDEE = avg intake − (lbs/day × kcal/lb).
  const tdee = round(avgIntake - fit.slope * CALORIES_PER_LB)
  return {
    tdee,
    avgIntake: round(avgIntake),
    lbsPerWeek,
    confidence,
    spanDays,
    weighInCount,
    intakeDayCount,
  }
}

/**
 * Daily calorie target to move at `lbsPerWeek` (negative = lose) given a known
 * maintenance. `floor` clamps the result so we never recommend a dangerously
 * low intake (defaults to 1200).
 */
export function targetIntakeForRate(
  tdee: number,
  lbsPerWeek: number,
  floor = 1200
): number {
  const daily = tdee + (lbsPerWeek / 7) * CALORIES_PER_LB
  return Math.max(floor, round(daily))
}

/**
 * A sensible weekly rate (lbs/week, signed) to move from current toward target
 * weight: up to 1 lb/week, capped at ~1% of bodyweight/week so it stays safe.
 * Returns 0 when already within a pound of target or target is unknown.
 */
export function recommendedRate(
  currentLbs: number,
  targetLbs: number | null
): number {
  if (targetLbs == null) return 0
  const diff = targetLbs - currentLbs
  if (Math.abs(diff) < 1) return 0
  const magnitude = Math.min(1, currentLbs * 0.01)
  return diff < 0 ? -round1(magnitude) : round1(magnitude)
}
