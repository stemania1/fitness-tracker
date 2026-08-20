/**
 * Does readiness actually predict *your* performance?
 *
 * The app already acts on Oura's readiness score: `readinessGate` downshifts
 * the day's prescribed session when it's low. Nothing has ever checked
 * whether that score predicts anything for this particular person, which
 * means a rule that costs real training days has never been audited against
 * its own outcomes.
 *
 * This answers it from data already in the database — `oura_daily.readiness_score`
 * against the session logged that day — and a null result is the useful one
 * as often as not: "readiness doesn't track your lifts" is a reason to stop
 * downshifting on it.
 *
 * ## Why performance is measured relative to each lift's own baseline
 *
 * Raw session volume can't answer this. It's dominated by which session it
 * was — a leg day dwarfs an accessory day at identical effort — and it drifts
 * upward as you get stronger. Either confound is larger than the effect being
 * looked for.
 *
 * So each lift is scored against *its own* recent history: today's best
 * estimated 1RM over the median of that lift's previous sessions. 1.04 means
 * four percent above your recent norm for that movement, whatever the
 * movement is. A session's score is the mean across its comparable lifts.
 * Progression does bias every session slightly above its own trailing
 * median — but it biases high- and low-readiness sessions equally, so the
 * comparison between them survives it.
 *
 * Pure so it's unit-tested; the card assembles sessions from logged workouts
 * and stored Oura days and feeds them in.
 */

import { estimateOneRepMax } from "./personal-records"

/** One logged working set. */
export interface PerfSet {
  weight: number | null
  reps: number | null
}

/** One exercise as performed within a session. */
export interface PerfExercise {
  /** Stable identifier for the movement — its own baseline is built per key. */
  exerciseKey: string
  /**
   * Assisted lifts (weight is counterweight, so less is better) are excluded:
   * an Epley estimate over assistance load is not a strength measure at all,
   * and inverting it would put a different unit into the same average.
   */
  assisted?: boolean
  sets: PerfSet[]
}

/** One logged session, paired with that day's readiness score. */
export interface PerfSession {
  /** Local date, YYYY-MM-DD. */
  day: string
  readiness: number | null
  exercises: PerfExercise[]
}

/** A session scored against its own lifts' recent norms. */
export interface SessionPerformance {
  day: string
  readiness: number
  /** Mean of per-lift (today / recent median); 1 = on par with your norm. */
  relative: number
  /** How many lifts had enough history to contribute. */
  lifts: number
}

/** How many prior sessions of a lift form its baseline. */
export const BASELINE_SESSIONS = 5

/** Sessions needed on each side before any comparison is reported. */
export const MIN_SESSIONS_PER_GROUP = 8

/**
 * Readiness points the two group means must differ by.
 *
 * Splitting at the median always produces a "high" and a "low" group even if
 * every score sits between 78 and 81. Comparing those is measuring noise and
 * calling it a finding.
 */
export const MIN_READINESS_SPREAD = 5

/**
 * Relative-performance difference worth calling a relationship.
 *
 * Session-to-session lifting varies for reasons that have nothing to do with
 * recovery — sleep on the gym floor, caffeine, whether the rack was free.
 * Below a few percent, a difference between groups is not distinguishable
 * from that churn.
 */
export const MEANINGFUL_DELTA = 0.03

export type ReadinessVerdict =
  | "not-enough-data"
  | "no-spread"
  | "no-relationship"
  | "predicts"
  | "inverse"

export interface ReadinessGroup {
  n: number
  meanReadiness: number
  meanRelative: number
}

export interface ReadinessPerformanceResult {
  verdict: ReadinessVerdict
  /** Sessions that could be scored at all. */
  sessions: number
  low: ReadinessGroup | null
  high: ReadinessGroup | null
  /** high − low, as a fraction of your norm. Positive = readiness tracks up. */
  delta: number
  headline: string
  detail: string
}

/** Median of a non-empty list. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Best estimated 1RM across a lift's sets; null if none are usable. */
export function bestE1RM(sets: PerfSet[]): number | null {
  let best: number | null = null
  for (const set of sets) {
    const e1rm = estimateOneRepMax(set.weight, set.reps)
    if (e1rm != null && (best == null || e1rm > best)) best = e1rm
  }
  return best
}

/**
 * Score each session against its own lifts' recent norms.
 *
 * Sessions are walked oldest-first so a lift's baseline only ever uses what
 * came before it — scoring a session against a median that includes itself
 * would pull every result toward 1 and hide exactly the effect being looked
 * for. Sessions with no lift that has prior history are dropped rather than
 * scored against nothing.
 */
export function sessionPerformances(
  sessions: PerfSession[],
  baselineSessions = BASELINE_SESSIONS
): SessionPerformance[] {
  const ordered = [...sessions].sort((a, b) => a.day.localeCompare(b.day))
  const history = new Map<string, number[]>()
  const out: SessionPerformance[] = []

  for (const session of ordered) {
    const ratios: number[] = []

    for (const exercise of session.exercises) {
      if (exercise.assisted) continue
      const today = bestE1RM(exercise.sets)
      if (today == null) continue

      const prior = history.get(exercise.exerciseKey) ?? []
      // Record after reading, so today never informs its own baseline.
      if (prior.length > 0) {
        const baseline = median(prior.slice(-baselineSessions))
        if (baseline > 0) ratios.push(today / baseline)
      }
      history.set(exercise.exerciseKey, [...prior, today])
    }

    if (session.readiness == null || ratios.length === 0) continue
    out.push({
      day: session.day,
      readiness: session.readiness,
      relative: mean(ratios),
      lifts: ratios.length,
    })
  }

  return out
}

function describe(
  verdict: ReadinessVerdict,
  delta: number,
  low: ReadinessGroup | null,
  high: ReadinessGroup | null,
  sessions: number
): { headline: string; detail: string } {
  const pct = Math.abs(Math.round(delta * 1000) / 10)

  switch (verdict) {
    case "not-enough-data":
      return {
        headline: "Not enough sessions yet",
        detail: `Comparing high- against low-readiness days needs ${MIN_SESSIONS_PER_GROUP} sessions on each side. You have ${sessions} scored so far.`,
      }
    case "no-spread":
      return {
        headline: "Your readiness barely moves",
        detail: `Readiness averaged ${Math.round(low?.meanReadiness ?? 0)} on the lower half of days and ${Math.round(high?.meanReadiness ?? 0)} on the upper — too close to tell the halves apart. Nothing to conclude either way.`,
      }
    case "predicts":
      return {
        headline: `You lift ${pct}% better on high-readiness days`,
        detail: `Across ${sessions} sessions, days above your median readiness (${Math.round(high?.meanReadiness ?? 0)}) came in ${pct}% above your normal working weights; days below it (${Math.round(low?.meanReadiness ?? 0)}) came in under. Backing off when readiness is low is doing something real for you.`,
      }
    case "inverse":
      return {
        headline: `You lift ${pct}% better on low-readiness days`,
        detail: `Across ${sessions} sessions, the lower-readiness half outperformed the higher by ${pct}%. That's the opposite of the expected direction — most often it means readiness is tracking hard training rather than predicting it, so treat it as a curiosity rather than a reason to chase low scores.`,
      }
    default:
      return {
        headline: "Readiness doesn't predict your lifts",
        detail: `Across ${sessions} sessions, high- and low-readiness days differ by ${pct}% — inside normal session-to-session variation. Your readiness score says something about recovery, but it isn't forecasting what you'll lift, so downshifting a session on a low score has no support in your own data.`,
      }
  }
}

/**
 * Compare performance on high- against low-readiness days.
 *
 * A median split rather than fixed bands: Oura's own thresholds mean little
 * for someone whose scores never leave the seventies, and the question is
 * whether *your* good days beat *your* bad ones. On an odd count the median
 * session is dropped, which sharpens the contrast rather than forcing an
 * ambiguous middle day onto one side.
 */
export function readinessPerformance(
  performances: SessionPerformance[]
): ReadinessPerformanceResult {
  const sessions = performances.length

  const empty = (verdict: ReadinessVerdict): ReadinessPerformanceResult => ({
    verdict,
    sessions,
    low: null,
    high: null,
    delta: 0,
    ...describe(verdict, 0, null, null, sessions),
  })

  if (sessions < MIN_SESSIONS_PER_GROUP * 2) return empty("not-enough-data")

  const sorted = [...performances].sort((a, b) => a.readiness - b.readiness)
  const half = Math.floor(sorted.length / 2)
  const lowHalf = sorted.slice(0, half)
  const highHalf = sorted.slice(sorted.length - half)

  const low: ReadinessGroup = {
    n: lowHalf.length,
    meanReadiness: mean(lowHalf.map((p) => p.readiness)),
    meanRelative: mean(lowHalf.map((p) => p.relative)),
  }
  const high: ReadinessGroup = {
    n: highHalf.length,
    meanReadiness: mean(highHalf.map((p) => p.readiness)),
    meanRelative: mean(highHalf.map((p) => p.relative)),
  }

  const delta = high.meanRelative - low.meanRelative
  const spread = high.meanReadiness - low.meanReadiness

  let verdict: ReadinessVerdict
  if (spread < MIN_READINESS_SPREAD) verdict = "no-spread"
  else if (delta >= MEANINGFUL_DELTA) verdict = "predicts"
  else if (delta <= -MEANINGFUL_DELTA) verdict = "inverse"
  else verdict = "no-relationship"

  return {
    verdict,
    sessions,
    low,
    high,
    delta,
    ...describe(verdict, delta, low, high, sessions),
  }
}
