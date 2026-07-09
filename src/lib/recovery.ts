/**
 * Recovery logic driven by Oura data:
 *  1. readinessGate — turn today's readiness score into a keep / moderate /
 *     downshift call for the day's prescribed session.
 *  2. hrvBaseline — compare a recent HRV window against a longer baseline to
 *     flag overreaching before it's consciously felt.
 *
 * Oura's readiness score already composites HRV balance, resting HR,
 * recovery index, and temperature, so the day-to-day gate keys off it. The
 * HRV baseline is a separate, slower signal that readiness alone misses.
 */

import type { PlanSession, SessionType } from "@/data/training-plan"
import type { DailyMetrics } from "@/lib/sleep-insights"

export type GateAction = "go" | "moderate" | "downshift" | "none"

export interface ReadinessGate {
  action: GateAction
  headline: string
  detail: string
}

/** Sessions intense enough that low readiness should downshift them. */
function isHardSession(session: PlanSession): boolean {
  return session.type === "cardio" || session.type === "strength"
}

/** What a hard session downshifts to when readiness is red. */
function downshiftTarget(type: SessionType): string {
  return type === "cardio"
    ? "easy Zone 2 (conversational pace) and slide the intervals to tomorrow"
    : "a lighter session — drop a set from each move and leave 3+ reps in reserve"
}

/**
 * Map today's readiness score onto a recommendation for the session.
 * Rest days never gate. Returns action "none" when readiness is unavailable.
 * Thresholds mirror the app's existing Oura insight bands (≥85 push,
 * 70-84 moderate, <70 back off).
 */
export function readinessGate(
  session: PlanSession,
  readinessScore: number | null | undefined
): ReadinessGate {
  if (readinessScore == null || !Number.isFinite(readinessScore)) {
    return { action: "none", headline: "", detail: "" }
  }
  if (session.type === "rest") {
    return {
      action: "none",
      headline: "",
      detail: "",
    }
  }

  if (readinessScore >= 85) {
    return {
      action: "go",
      headline: `Readiness ${readinessScore} — green light`,
      detail: "Your body is primed. Hit the prescribed session as written.",
    }
  }
  if (readinessScore >= 70) {
    return {
      action: "moderate",
      headline: `Readiness ${readinessScore} — proceed with feel`,
      detail:
        "Solid but not peak. Do the session, but hold back the last gear and stop a rep short.",
    }
  }
  if (!isHardSession(session)) {
    return { action: "none", headline: "", detail: "" }
  }
  return {
    action: "downshift",
    headline: `Readiness ${readinessScore} — downshift, don't skip`,
    detail: `Your body is still recovering. Swap today for ${downshiftTarget(
      session.type
    )}.`,
  }
}

export type HrvStatus = "normal" | "suppressed" | "low" | "insufficient"

export interface HrvBaseline {
  status: HrvStatus
  /** Mean nightly HRV over the recent window (ms), or null. */
  recentAvg: number | null
  /** Mean nightly HRV over the baseline window (ms), or null. */
  baselineAvg: number | null
  /** Recent vs baseline, percent (negative = suppressed). */
  deltaPct: number | null
  recentNights: number
  baselineNights: number
  message: string
}

const RECENT_DAYS = 7
/** Minimum nights needed in each window to make a call. */
const MIN_RECENT = 4
const MIN_BASELINE = 14
/** Suppression thresholds on the recent-vs-baseline percent drop. */
const SUPPRESSED_PCT = -5
const LOW_PCT = -10

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/**
 * Compare the most recent RECENT_DAYS of nightly HRV against the older
 * baseline window. A sustained drop is an early overreaching signal.
 *
 * `metrics` may be in any order; the most recent RECENT_DAYS by date form
 * the recent window, the remainder (up to ~8 weeks) the baseline.
 */
export function hrvBaseline(metrics: DailyMetrics[]): HrvBaseline {
  const withHrv = metrics
    .filter((m) => m.averageHrv != null && Number.isFinite(m.averageHrv))
    .sort((a, b) => a.day.localeCompare(b.day))

  const insufficient = (): HrvBaseline => ({
    status: "insufficient",
    recentAvg: null,
    baselineAvg: null,
    deltaPct: null,
    recentNights: 0,
    baselineNights: 0,
    message: "Not enough HRV history yet to set a baseline (need ~3 weeks).",
  })

  if (withHrv.length < MIN_RECENT + MIN_BASELINE) return insufficient()

  const recent = withHrv.slice(-RECENT_DAYS)
  const baseline = withHrv.slice(0, withHrv.length - RECENT_DAYS)

  if (recent.length < MIN_RECENT || baseline.length < MIN_BASELINE) {
    return insufficient()
  }

  const recentAvg = mean(recent.map((m) => m.averageHrv as number))
  const baselineAvg = mean(baseline.map((m) => m.averageHrv as number))
  const deltaPct = ((recentAvg - baselineAvg) / baselineAvg) * 100

  let status: HrvStatus = "normal"
  if (deltaPct <= LOW_PCT) status = "low"
  else if (deltaPct <= SUPPRESSED_PCT) status = "suppressed"

  const rounded = Math.round(deltaPct)
  const message =
    status === "normal"
      ? `HRV is holding at baseline (${rounded >= 0 ? "+" : ""}${rounded}% over ${recent.length} nights). Recovery looks on track.`
      : status === "suppressed"
        ? `HRV is running ${Math.abs(rounded)}% below your baseline. Early sign of accumulated fatigue — favor Zone 2 and protect sleep this week.`
        : `HRV is ${Math.abs(rounded)}% below baseline — a strong overreaching signal. Take an extra rest day and hold intensity down until it recovers.`

  return {
    status,
    recentAvg: Math.round(recentAvg),
    baselineAvg: Math.round(baselineAvg),
    deltaPct: rounded,
    recentNights: recent.length,
    baselineNights: baseline.length,
    message,
  }
}
