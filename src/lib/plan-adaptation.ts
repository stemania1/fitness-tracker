/**
 * Missed-session detection for the 12-week plan, encoding the plan doc's
 * own recovery rules as code:
 *
 *   - Baseline/retest weekends (weeks 1, 6, 12) take priority: a missing
 *     pull-up max swaps into the next strength day's first exercise, a
 *     missing Cooper test replaces the next hard-cardio session.
 *   - A missed regular session slides to the next rest day.
 *   - Never stack two sessions; never chase misses older than a week —
 *     they expire and the plan just resumes.
 *
 * Everything is suggestion-only: this module proposes, the user decides.
 * Detection is deliberately simple — a planned session counts as done when
 * a workout log with the session's exact title exists within +/- 1 day
 * (so doing Saturday's session on Sunday doesn't flag a miss). Freestyle
 * logs under other names won't match; that's accepted imprecision.
 */

import {
  PLAN_START_DATE,
  PLAN_TESTS,
  type PlanSession,
} from "@/data/training-plan"
import { planWeekNumber, sessionForDate } from "@/lib/training-plan"

/** Shape of a workout_logs row the detector needs. */
export interface RecentWorkout {
  name: string
  /** ISO timestamp. */
  started_at: string
}

/** Shape of a fitness_tests row the detector needs. */
export interface RecentTest {
  test_type: string
  /** YYYY-MM-DD */
  tested_at: string
}

export interface PlanSuggestion {
  kind: "pullup-test" | "cooper-test" | "slide-session"
  headline: string
  detail: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
/** Misses older than this stop being suggested — the plan just resumes. */
const MISS_GRACE_DAYS = 7

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Whole days from `b` to `a` (positive when `a` is later). */
function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY)
}

function weekdayName(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" })
}

/** Local midnight of the plan's week-1 Monday. */
function planStart(): Date {
  const [y, m, d] = PLAN_START_DATE.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Local midnight for a YYYY-MM-DD string. */
function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function mondayOfWeek(week: number): Date {
  return addDays(planStart(), (week - 1) * 7)
}

function loggedOn(
  workouts: RecentWorkout[],
  title: string,
  day: Date
): boolean {
  return workouts.some(
    (w) =>
      w.name === title && Math.abs(diffDays(new Date(w.started_at), day)) <= 1
  )
}

function testLoggedNear(
  tests: RecentTest[],
  testType: string,
  day: Date
): boolean {
  return tests.some(
    (t) =>
      t.test_type === testType &&
      Math.abs(diffDays(parseYmd(t.tested_at), day)) <= MISS_GRACE_DAYS
  )
}

/** Next day (today included) whose planned session matches, within a week. */
function nextSessionDay(
  from: Date,
  type: PlanSession["type"]
): { day: Date; session: PlanSession } | null {
  for (let ahead = 0; ahead <= 6; ahead++) {
    const day = addDays(from, ahead)
    if (planWeekNumber(day) == null) continue
    const session = sessionForDate(day)
    if (session.type === type) return { day, session }
  }
  return null
}

/** "today" / "on Thursday" phrasing for a target day. */
function dayLabel(target: Date, today: Date): string {
  return diffDays(target, today) === 0 ? "today" : `on ${weekdayName(target)}`
}

/**
 * At most one suggestion for what to do about recently missed plan work,
 * or null when everything is on track (or misses have expired).
 */
export function planSuggestion(
  today: Date,
  workouts: RecentWorkout[],
  tests: RecentTest[]
): PlanSuggestion | null {
  const t0 = startOfDay(today)

  // Test weekends first — the baseline/retest numbers are what the whole
  // plan is measured against. Oldest scheduled test first.
  for (const planTest of PLAN_TESTS) {
    const monday = mondayOfWeek(planTest.week)
    const slots = [
      { type: "pullup_max", day: addDays(monday, 5) }, // Saturday
      { type: "cooper_run", day: addDays(monday, 6) }, // Sunday
    ]
    for (const slot of slots) {
      const daysSince = diffDays(t0, slot.day)
      // Not overdue yet (the day isn't over), or expired.
      if (daysSince <= 0 || daysSince > MISS_GRACE_DAYS) continue
      if (testLoggedNear(tests, slot.type, slot.day)) continue

      if (slot.type === "cooper_run") {
        const next = nextSessionDay(t0, "cardio")
        if (!next) return null
        return {
          kind: "cooper-test",
          headline: "Cooper 12-min test still to do",
          detail:
            `It wasn't logged over the test weekend. Do it ${dayLabel(next.day, t0)} ` +
            `in place of ${next.session.title}: 10-min warm-up, then max distance ` +
            `in 12 minutes at 1% incline. Log it via Log Test.`,
        }
      }
      const next = nextSessionDay(t0, "strength")
      if (!next) return null
      const possessive =
        diffDays(next.day, t0) === 0 ? "today's" : `${weekdayName(next.day)}'s`
      return {
        kind: "pullup-test",
        headline: "Pull-up max test still to do",
        detail:
          `It wasn't logged over the test weekend. Swap it in as the first ` +
          `exercise of ${possessive} ${next.session.title}: max strict pull-ups ` +
          `(or a timed negative). Log it via Log Test.`,
      }
    }
  }

  // Most recent missed regular session slides to the next rest day.
  for (let back = 1; back <= MISS_GRACE_DAYS; back++) {
    const day = addDays(t0, -back)
    const week = planWeekNumber(day)
    if (week == null) continue
    const session = sessionForDate(day)
    if (session.type === "rest") continue
    // Test-week Sundays are the Cooper slot — handled above, not a
    // regular miss (the test replaces the intervals those weeks).
    if (day.getDay() === 0 && PLAN_TESTS.some((t) => t.week === week)) continue
    if (loggedOn(workouts, session.title, day)) continue

    const rest = nextSessionDay(t0, "rest")
    if (!rest) return null
    const restLabel =
      diffDays(rest.day, t0) === 0 ? "Today" : weekdayName(rest.day)
    return {
      kind: "slide-session",
      headline: `Missed: ${session.title}`,
      detail:
        `Planned for ${weekdayName(day)} but never logged. ${restLabel} is a ` +
        `rest day — do it then instead of stacking it onto another session. ` +
        `If it's more than a few days stale, just let it go and resume.`,
    }
  }

  return null
}
