/**
 * Energy read: fuse the day's objective signals — sleep, recovery/HRV,
 * training load, fuel, and time of day — into an EXPECTED energy level,
 * then reconcile that against how the user actually FEELS.
 *
 * Two ideas the rest of the app doesn't yet cover in one place:
 *  1. A single expected-energy read that blends the siloed signals
 *     (readiness gates only workouts; sleep insights only cover REM).
 *  2. Felt-vs-expected reconciliation — validating a normal feeling
 *     ("tired at 9pm after a hard day tracks") or flagging a surprise
 *     worth a second look ("drained but every signal is green").
 *
 * Everything degrades gracefully: with no objective signals the
 * expectation falls back to a neutral baseline shaped only by time of
 * day, so this is useful on manual input alone — no wearable required.
 *
 * This is guidance, not diagnosis. Messages stay non-clinical.
 */

import type { HrvStatus } from "@/lib/recovery"

/** Subjective energy, 1 (drained) … 5 (energized). */
export type EnergyLevel = 1 | 2 | 3 | 4 | 5
export type PartOfDay = "morning" | "afternoon" | "evening"
export type EnergyBand = "low" | "moderate" | "high"
/** How the felt level compares to the expected one. */
export type EnergyVerdict = "matches" | "below" | "above"

/** Optional fuel signal: has the day's intake kept pace with need? */
export type FuelState = "under" | "adequate" | "over"

export interface EnergyInputs {
  /** Local hour of the check-in, 0-23. Drives the circadian expectation. */
  hour: number
  /** Oura sleep score for last night, 0-100. */
  sleepScore?: number | null
  /** Total sleep last night, in minutes. */
  sleepMinutes?: number | null
  /** Oura readiness score, 0-100 (already blends HRV / resting HR / recovery). */
  readinessScore?: number | null
  /** HRV-vs-baseline status from hrvBaseline(); used only when readiness is absent. */
  hrvStatus?: HrvStatus | null
  /** Did the user train (hard) today? Expected fatigue, not a red flag. */
  trainedHardToday?: boolean | null
  /** Fuel state for the day so far. */
  fuel?: FuelState | null
}

/** One reason the expectation moved off baseline, with its direction. */
export interface EnergyDriver {
  label: string
  direction: "up" | "down"
}

export interface EnergyExpectation {
  /** Expected energy on the same 1-5 scale as the subjective input. */
  score: number
  band: EnergyBand
  /** How many objective signals fed the estimate (0 = time-of-day only). */
  signalCount: number
  /** The biggest movers, strongest first. */
  drivers: EnergyDriver[]
}

export interface EnergyReadout {
  expectation: EnergyExpectation
  felt: EnergyLevel
  verdict: EnergyVerdict
  headline: string
  detail: string
}

const BASELINE = 3

export function partOfDay(hour: number): PartOfDay {
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}

function bandOf(score: number): EnergyBand {
  if (score < 2.5) return "low"
  if (score < 3.5) return "moderate"
  return "high"
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

const bandLabel: Record<EnergyBand, string> = {
  low: "low",
  moderate: "moderate",
  high: "high",
}

/**
 * Blend the available signals into an expected energy level. Each signal
 * nudges a neutral baseline up or down; the magnitudes reflect how strongly
 * each one tends to move same-day energy (sleep and recovery dominate).
 */
export function expectedEnergy(inputs: EnergyInputs): EnergyExpectation {
  const drivers: Array<EnergyDriver & { weight: number }> = []
  let score = BASELINE
  let signalCount = 0

  const add = (delta: number, label: string) => {
    score += delta
    drivers.push({
      label,
      direction: delta >= 0 ? "up" : "down",
      weight: Math.abs(delta),
    })
  }

  // Sleep — the strongest lever. Prefer the composite score, fall back to duration.
  if (inputs.sleepScore != null) {
    signalCount++
    if (inputs.sleepScore >= 85) add(1.0, "Great sleep last night")
    else if (inputs.sleepScore >= 70) add(0.25, "Decent sleep last night")
    else if (inputs.sleepScore >= 55) add(-0.75, "Below-par sleep last night")
    else add(-1.25, "Poor sleep last night")
  } else if (inputs.sleepMinutes != null) {
    signalCount++
    if (inputs.sleepMinutes >= 450) add(0.75, "Plenty of sleep last night")
    else if (inputs.sleepMinutes >= 390) add(0.25, "A full night's sleep")
    else if (inputs.sleepMinutes >= 330) add(-0.5, "A little short on sleep")
    else add(-1.0, "Not much sleep last night")
  }

  // A very short night drags energy even when the score looked okay.
  if (inputs.sleepMinutes != null && inputs.sleepMinutes < 360 && inputs.sleepScore != null) {
    add(-0.5, "Short sleep (under 6h)")
  }

  // Recovery. Readiness already composites HRV, so use it in preference to the
  // raw HRV trend to avoid double-counting the same signal.
  if (inputs.readinessScore != null) {
    signalCount++
    if (inputs.readinessScore >= 85) add(0.5, "Recovery is high")
    else if (inputs.readinessScore < 70) add(-0.75, "Recovery is low")
  } else if (inputs.hrvStatus === "low") {
    signalCount++
    add(-0.75, "HRV well below baseline")
  } else if (inputs.hrvStatus === "suppressed") {
    signalCount++
    add(-0.4, "HRV below baseline")
  }

  // Training today — expected, healthy fatigue that still lowers current energy.
  if (inputs.trainedHardToday) {
    signalCount++
    add(-0.5, "Trained hard today")
  }

  // Fuel.
  if (inputs.fuel === "under") {
    signalCount++
    add(-0.6, "Under-fueled for the day")
  } else if (inputs.fuel === "over") {
    signalCount++
    add(-0.25, "Just ate a large meal")
  }

  // Circadian shape. Evening wind-down and the early-afternoon dip are normal.
  const part = partOfDay(inputs.hour)
  if (inputs.hour >= 21) add(-0.75, "Late evening wind-down")
  else if (part === "evening") add(-0.5, "Evening wind-down")
  else if (inputs.hour >= 13 && inputs.hour <= 15) add(-0.3, "Early-afternoon dip")
  else if (inputs.hour < 7) add(-0.3, "Very early morning")

  const topDrivers = drivers
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(({ label, direction }) => ({ label, direction }))

  const finalScore = clamp(score, 1, 5)
  return {
    score: Math.round(finalScore * 10) / 10,
    band: bandOf(finalScore),
    signalCount,
    drivers: topDrivers,
  }
}

/**
 * Compare how the user feels against what the signals predict. Within ~0.75
 * of expected reads as a match; a bigger gap is surfaced as feeling worse
 * (worth a look) or better (a bonus) than the day would suggest.
 */
export function reconcileEnergy(
  felt: EnergyLevel,
  expectation: EnergyExpectation
): EnergyReadout {
  const diff = felt - expectation.score
  const expectedLabel = bandLabel[expectation.band]
  const softHedge =
    expectation.signalCount === 0
      ? " (based on time of day alone — log sleep or connect a ring for a sharper read)"
      : ""

  let verdict: EnergyVerdict
  let headline: string
  let detail: string

  if (Math.abs(diff) <= 0.75) {
    verdict = "matches"
    headline = "This tracks."
    detail =
      `What you're feeling lines up with a ${expectedLabel}-energy read${softHedge}. ` +
      "Nothing here looks off — trust it and act accordingly."
  } else if (diff < 0) {
    verdict = "below"
    headline = "Lower than your day would predict."
    detail =
      `Your signals point to ${expectedLabel} energy, but you're feeling more drained than that${softHedge}. ` +
      "Common culprits the app can't see: hydration, under-eating, a stressful day, poor light/screen exposure, or a bug coming on. Worth a gentle check-in with yourself."
  } else {
    verdict = "above"
    headline = "More in the tank than expected."
    detail =
      `Your signals point to ${expectedLabel} energy, yet you feel better than that${softHedge} — nice. ` +
      "Ride it, but don't let a great evening turn into a late night before tomorrow's session."
  }

  return { expectation, felt, verdict, headline, detail }
}

/** Convenience: expected read, plus the reconciliation when a felt level is given. */
export function assessEnergy(
  inputs: EnergyInputs,
  felt?: EnergyLevel | null
): { expectation: EnergyExpectation; readout: EnergyReadout | null } {
  const expectation = expectedEnergy(inputs)
  const readout =
    felt != null ? reconcileEnergy(felt, expectation) : null
  return { expectation, readout }
}
