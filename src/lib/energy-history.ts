/**
 * Felt-vs-expected energy over time.
 *
 * The check-in card answers this for today; nothing answered it across weeks.
 * The pattern is the interesting part — consistently feeling below what your
 * sleep and recovery predict is a different signal from one rough morning,
 * and it's the kind of thing only a series can show.
 *
 * `energy_checkins` stores what you REPORTED but not what was expected: the
 * expectation is computed live from that day's signals. So history has to be
 * rebuilt by re-running `expectedEnergy` over the signals that were stored —
 * Oura, workouts, meals, caffeine. That works retroactively, which is the
 * whole reason to do it this way, but it means the series reflects today's
 * model rather than whatever the card said at the time. Two consequences
 * worth knowing: a day whose Oura data arrived late will read differently
 * than it did on the day, and changing the scoring re-writes history.
 *
 * Pure — the card does the DB work and hands the assembled days in.
 */

import { expectedEnergy, type EnergyInputs } from "./energy"

/** One day's check-in plus the signals available for that day. */
export interface EnergyHistoryDay {
  /** Local date, YYYY-MM-DD. */
  day: string
  /** What the user reported, 1-5. */
  felt: number
  /** Signals for that day, minus the hour (taken from `hour` below). */
  signals: Omit<EnergyInputs, "hour">
  /** Local hour of the check-in — the circadian term needs the real one. */
  hour: number
}

export interface EnergyHistoryPoint {
  day: string
  felt: number
  /** Recomputed expectation, 1-5, to one decimal. */
  expected: number
  /** felt − expected. Positive means you felt better than predicted. */
  delta: number
}

export type EnergyPattern = "above" | "below" | "tracking" | "mixed"

export interface EnergyHistory {
  points: EnergyHistoryPoint[]
  /** Mean felt − expected across the window, to one decimal. */
  meanDelta: number
  /** Days that landed above / below / within the match band. */
  aboveDays: number
  belowDays: number
  matchingDays: number
  pattern: EnergyPattern
  /** A sentence for the card, or null when there isn't enough to say. */
  summary: string | null
}

/**
 * Gap below which a day counts as "tracking". Same 0.75 the check-in card
 * uses for its matches/below/above verdict, so a day can't read as a match on
 * the dashboard and a miss on the chart.
 */
export const MATCH_BAND = 0.75

/**
 * Days needed before the summary will characterize a pattern. Below this,
 * the chart still draws — seeing three points is fine — but calling three
 * days a trend is how you get told your life is falling apart because you
 * slept badly twice.
 */
export const MIN_DAYS_FOR_PATTERN = 7

export function buildEnergyHistory(days: EnergyHistoryDay[]): EnergyHistory {
  const points = days
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => {
      const expected = round1(
        expectedEnergy({ ...d.signals, hour: d.hour }).score
      )
      return {
        day: d.day,
        felt: d.felt,
        expected,
        delta: round1(d.felt - expected),
      }
    })

  if (points.length === 0) {
    return {
      points,
      meanDelta: 0,
      aboveDays: 0,
      belowDays: 0,
      matchingDays: 0,
      pattern: "mixed",
      summary: null,
    }
  }

  const aboveDays = points.filter((p) => p.delta > MATCH_BAND).length
  const belowDays = points.filter((p) => p.delta < -MATCH_BAND).length
  const matchingDays = points.length - aboveDays - belowDays
  const meanDelta = round1(
    points.reduce((sum, p) => sum + p.delta, 0) / points.length
  )

  const pattern = classify(points.length, meanDelta, matchingDays)

  return {
    points,
    meanDelta,
    aboveDays,
    belowDays,
    matchingDays,
    pattern,
    summary:
      points.length < MIN_DAYS_FOR_PATTERN
        ? null
        : summarize(pattern, meanDelta, points.length, matchingDays),
  }
}

function classify(
  count: number,
  meanDelta: number,
  matchingDays: number
): EnergyPattern {
  if (count < MIN_DAYS_FOR_PATTERN) return "mixed"
  // A majority of days inside the band is the model working, whatever the
  // mean does — small opposite-signed misses cancel and look like tracking
  // when they aren't, so the day count has to agree.
  if (matchingDays / count >= 0.6 && Math.abs(meanDelta) <= MATCH_BAND) {
    return "tracking"
  }
  if (meanDelta > MATCH_BAND / 2) return "above"
  if (meanDelta < -MATCH_BAND / 2) return "below"
  return "mixed"
}

function summarize(
  pattern: EnergyPattern,
  meanDelta: number,
  count: number,
  matchingDays: number
): string {
  const gap = Math.abs(meanDelta).toFixed(1)
  switch (pattern) {
    case "tracking":
      return `How you feel matches your signals on ${matchingDays} of ${count} days — the read is calibrated to you.`
    case "below":
      return (
        `You've been feeling about ${gap} below what your signals predict, across ${count} days. ` +
        "A persistent gap usually points at something the app can't see — hydration, stress, illness, or under-eating."
      )
    case "above":
      return (
        `You've been feeling about ${gap} above what your signals predict, across ${count} days. ` +
        "Worth knowing: your numbers may be understating how well you're actually doing."
      )
    default:
      return `Your energy has swung both sides of the prediction over ${count} days — no consistent gap yet.`
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
