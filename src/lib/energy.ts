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
import type { CaffeineLevel } from "@/lib/caffeine"

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
  /** Current caffeine state: alertness on board vs. a dose wearing off. */
  caffeine?: CaffeineLevel | null
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

/** Signals needed to infer the day's fuel state from logged food. */
export interface FuelSignal {
  /** Local hour, 0-23. Fueling expectations scale with how far into the day it is. */
  hour: number
  /** Calories logged so far today, or null if unknown. */
  caloriesConsumed?: number | null
  /** Recommended daily calorie target, or null if not set. */
  calorieTarget?: number | null
  /** Minutes since the most recent meal, or null if nothing logged today. */
  minutesSinceLastMeal?: number | null
}

/** Rough share of daily calories a person would have eaten by a given hour. */
function expectedIntakeFraction(hour: number): number {
  if (hour < 8) return 0
  if (hour >= 21) return 1
  return clamp(((hour - 8) / 13) * 0.9 + 0.1, 0, 1)
}

/**
 * Infer a FuelState from the day's food log:
 *  - a recent meal drives the postprandial dip ("over"), regardless of totals;
 *  - being well behind the expected intake for the hour reads as "under";
 *  - otherwise "adequate". Returns null when there isn't enough to judge.
 */
export function deriveFuelState(sig: FuelSignal): FuelState | null {
  if (sig.minutesSinceLastMeal != null && sig.minutesSinceLastMeal <= 45) {
    return "over"
  }
  if (
    sig.caloriesConsumed == null ||
    sig.calorieTarget == null ||
    sig.calorieTarget <= 0
  ) {
    return null
  }
  const frac = sig.caloriesConsumed / sig.calorieTarget
  const expected = expectedIntakeFraction(sig.hour)
  if (expected >= 0.3 && frac < expected - 0.3) return "under"
  return "adequate"
}

function bandOf(score: number): EnergyBand {
  if (score < 2.5) return "low"
  if (score < 3.5) return "moderate"
  return "high"
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * The 1-5 scale, in the user's words — the single vocabulary for both what
 * they report and what we expect.
 *
 * The check-in used to speak two languages at once: five words on the buttons
 * (Drained…Energized) and a three-way band on the badge (low/moderate/high).
 * "Expected: High" matched no button — it spans Good, Energized, and the gap
 * below them — and "Low" meant one thing as a button (exactly 2) and another
 * as a band (anything under 2.5). The bands still drive the chip's color;
 * they just aren't what anyone reads.
 */
export const ENERGY_LEVEL_LABELS: Record<EnergyLevel, string> = {
  1: "Drained",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Energized",
}

/** The nearest scale word to a (possibly fractional) expected score. */
export function energyLevelLabel(score: number): string {
  const level = clamp(Math.round(score), 1, 5) as EnergyLevel
  return ENERGY_LEVEL_LABELS[level]
}

/**
 * How far a fractional expectation can sit from a whole level before naming it
 * by that level's word alone becomes a lie.
 *
 * An expectation of 2.6 is not "Okay". Rounding it to one and then telling
 * someone who logged 2 (Low) that their feeling "lines up with the 3 (Okay)
 * read" contradicts itself on the page — the words Low and Okay are the whole
 * vocabulary of the card, and it just used one to mean the other. Inside the
 * tolerance the nearer word is honest shorthand; outside it, say both.
 */
const LEVEL_NAMING_TOLERANCE = 0.25

/** The one or two scale levels a score is fairly named by. */
function levelSpan(score: number): { lo: EnergyLevel; hi: EnergyLevel } {
  const clamped = clamp(score, 1, 5)
  const nearest = clamp(Math.round(clamped), 1, 5) as EnergyLevel
  if (Math.abs(clamped - nearest) <= LEVEL_NAMING_TOLERANCE) {
    return { lo: nearest, hi: nearest }
  }
  return {
    lo: clamp(Math.floor(clamped), 1, 5) as EnergyLevel,
    hi: clamp(Math.ceil(clamped), 1, 5) as EnergyLevel,
  }
}

/**
 * How the expectation is named in prose: "4 (Good)", or "2-3 (Low to Okay)"
 * when it genuinely falls between two words. The number carries the comparison
 * — the buttons lead with numbers — and the word keeps it readable without
 * inventing a second vocabulary.
 */
export function energyLevelText(score: number): string {
  const { lo, hi } = levelSpan(score)
  if (lo === hi) return `${lo} (${ENERGY_LEVEL_LABELS[lo]})`
  return `${lo}-${hi} (${ENERGY_LEVEL_LABELS[lo]} to ${ENERGY_LEVEL_LABELS[hi]})`
}

/**
 * The badge's short form — the same honesty rule without the numbers, since
 * a badge reading "Expected: Okay" beside prose reading "2-3 (Low to Okay)"
 * puts the card back to speaking two languages about one number.
 */
export function energyExpectedLabel(score: number): string {
  const { lo, hi } = levelSpan(score)
  if (lo === hi) return ENERGY_LEVEL_LABELS[lo]
  return `${ENERGY_LEVEL_LABELS[lo]}-${ENERGY_LEVEL_LABELS[hi]}`
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

  // Sleep — the strongest lever. Prefer the composite score, fall back to
  // duration. When the night was also short (<6h) we fold the duration
  // penalty into the SAME driver so the read never shows a "good sleep" and a
  // "short sleep" chip side by side — one honest chip that says quality was
  // fine but the hours weren't.
  if (inputs.sleepScore != null) {
    signalCount++
    const short = inputs.sleepMinutes != null && inputs.sleepMinutes < 360
    const hrs = short ? `~${((inputs.sleepMinutes as number) / 60).toFixed(1)}h` : ""
    if (inputs.sleepScore >= 85) {
      if (short) add(0.5, `Good sleep, just short (${hrs})`)
      else add(1.0, "Great sleep last night")
    } else if (inputs.sleepScore >= 70) {
      if (short) add(-0.25, `Short sleep (${hrs}), decent quality`)
      else add(0.25, "Decent sleep last night")
    } else if (inputs.sleepScore >= 55) {
      if (short) add(-1.25, `Short, below-par sleep (${hrs})`)
      else add(-0.75, "Below-par sleep last night")
    } else {
      if (short) add(-1.75, `Very short, poor sleep (${hrs})`)
      else add(-1.25, "Poor sleep last night")
    }
  } else if (inputs.sleepMinutes != null) {
    signalCount++
    if (inputs.sleepMinutes >= 450) add(0.75, "Plenty of sleep last night")
    else if (inputs.sleepMinutes >= 390) add(0.25, "A full night's sleep")
    else if (inputs.sleepMinutes >= 330) add(-0.5, "A little short on sleep")
    else add(-1.0, "Not much sleep last night")
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

  // Caffeine masks fatigue rather than adding real energy, so the effect is
  // deliberately small: a nudge up while it's on board, a mild dip as a real
  // dose wears off (the crash).
  if (inputs.caffeine === "active") {
    signalCount++
    add(0.4, "Caffeine on board")
  } else if (inputs.caffeine === "fading") {
    signalCount++
    add(-0.3, "Caffeine wearing off")
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

/** The check-in question, phrased for the part of day — "right now" is the
 *  one wording that fits none of them well. */
export function checkinPrompt(part: PartOfDay): string {
  switch (part) {
    case "morning":
      return "How are you starting the day?"
    case "afternoon":
      return "How's your energy holding up?"
    case "evening":
      return "How's your energy this evening?"
  }
}

/**
 * Compare how the user feels against what the signals predict. Within ~0.75
 * of expected reads as a match; a bigger gap is surfaced as feeling worse
 * (worth a look) or better (a bonus) than the day would suggest.
 *
 * The copy carries no numbers. It used to name the expectation — "your
 * signals point to 3 (Okay) energy" — while never once saying what the user
 * had actually logged, which made a comparison card that showed only one side
 * of the comparison. Both levels now sit in a row above this text, and
 * repeating either one here would just say it twice.
 *
 * The framing is per part of day: a strong morning is a base to train on, a
 * strong evening is a late-night risk, a drained morning gets get-going advice
 * while a drained evening gets wind-down advice. Defaults to the neutral
 * mid-day framing when no part is given.
 */
export function reconcileEnergy(
  felt: EnergyLevel,
  expectation: EnergyExpectation,
  part: PartOfDay = "afternoon"
): EnergyReadout {
  const diff = felt - expectation.score
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
    const tail =
      part === "morning"
        ? "A steady start — plan today's effort around it."
        : part === "evening"
          ? "Evenings run lower by design — let the wind-down do its job."
          : "Nothing here looks off — trust it and act accordingly."
    detail = `What you're feeling matches what the day predicts${softHedge}. ${tail}`
  } else if (diff < 0) {
    verdict = "below"
    if (part === "morning") {
      headline = "Rougher start than your night would predict."
      detail =
        `The morning feels heavier than your signals predict${softHedge}. ` +
        "Slow starts often lift with light, water, and a little movement — if it hasn't lifted by mid-morning, scale today's session down rather than skipping it."
    } else if (part === "evening") {
      headline = "More drained than a normal wind-down."
      detail =
        `Tonight feels emptier than your signals predict${softHedge}. ` +
        "One off evening is just a day; if most evenings feel like this, the usual culprits are sleep debt and under-eating. Either way, tonight's best move is an early wind-down."
    } else {
      headline = "Lower than your day would predict."
      detail =
        `You're feeling more drained than your signals predict${softHedge}. ` +
        "Common culprits the app can't see: hydration, under-eating, a stressful day, poor light/screen exposure, or a bug coming on. Worth a gentle check-in with yourself."
    }
  } else {
    verdict = "above"
    if (part === "morning") {
      headline = "Up and running ahead of your signals."
      detail =
        `You're feeling stronger than your signals predict${softHedge} — a good base for the day. ` +
        "If a hard session is on the plan, this is the morning for it."
    } else if (part === "evening") {
      headline = "More in the tank than expected."
      detail =
        `You feel better than your signals predict${softHedge} — nice. ` +
        "Ride it, but don't let a great evening turn into a late night before tomorrow's session."
    } else {
      headline = "More in the tank than expected."
      detail =
        `You feel better than your signals predict${softHedge} — nice. ` +
        "A good window for the day's hardest thing, training included."
    }
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
    felt != null
      ? reconcileEnergy(felt, expectation, partOfDay(inputs.hour))
      : null
  return { expectation, readout }
}
