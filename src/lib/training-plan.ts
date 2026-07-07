/**
 * Date logic for the 12-week training plan: which plan week a date falls
 * in, what session is prescribed, and any week-level overlays (deload,
 * test weekends, phase-specific prescriptions).
 */

import {
  PLAN_START_DATE,
  PLAN_WEEKS,
  DELOAD_WEEK,
  PLAN_PHASES,
  PLAN_TESTS,
  WEEKLY_SCHEDULE,
  type PlanPhase,
  type PlanSession,
} from "@/data/training-plan"

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Midnight (local) for a Date. */
function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function planStart(): Date {
  // Parse as local midnight, not UTC, so week boundaries match the user's day.
  const [y, m, d] = PLAN_START_DATE.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/**
 * 1-based plan week for a date, or null outside the plan window
 * (before the start, or after week 12 ends).
 */
export function planWeekNumber(date: Date): number | null {
  const days = Math.floor(
    (startOfDay(date).getTime() - planStart().getTime()) / MS_PER_DAY
  )
  if (days < 0) return null
  const week = Math.floor(days / 7) + 1
  return week > PLAN_WEEKS ? null : week
}

/** The prescribed session for a date's weekday. */
export function sessionForDate(date: Date): PlanSession {
  return WEEKLY_SCHEDULE[date.getDay()]
}

/** The phase covering a plan week, or null outside the plan. */
export function phaseForWeek(week: number | null): PlanPhase | null {
  if (week == null) return null
  return (
    PLAN_PHASES.find((p) => week >= p.fromWeek && week <= p.toWeek) ?? null
  )
}

export interface TodayPlan {
  /** null before the plan starts or after it ends. */
  week: number | null
  session: PlanSession
  phase: PlanPhase | null
  isDeload: boolean
  /** Set when this week has a test protocol (weeks 1, 6, 12). */
  testTitle: string | null
  /** Phase-adjusted note for today's session, when one applies. */
  sessionNote: string | null
}

/**
 * Everything the dashboard card needs about a given date, in one call.
 */
export function todayPlan(date: Date): TodayPlan {
  const week = planWeekNumber(date)
  const session = sessionForDate(date)
  const phase = phaseForWeek(week)
  const test = week != null ? PLAN_TESTS.find((t) => t.week === week) : undefined

  let sessionNote: string | null = null
  if (phase) {
    if (session.key === "intervals-4x4") {
      sessionNote = `This phase (${phase.label}): ${phase.fourByFourRounds}`
    } else if (session.key === "intervals-3030") {
      sessionNote = `This phase (${phase.label}): ${phase.thirtyThirtyReps}`
    } else if (session.type === "strength") {
      sessionNote = phase.pullNote
    }
  }

  return {
    week,
    session,
    phase,
    isDeload: week === DELOAD_WEEK,
    testTitle: test?.title ?? null,
    sessionNote,
  }
}
