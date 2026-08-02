/**
 * A day-by-day audit of what the plan expected against what is actually in
 * the database.
 *
 * Built because "Missed: VO2 Max intervals — 4×4" is unfalsifiable from the
 * dashboard: it states a conclusion without showing the evidence, so a user
 * who *did* the session has no way to tell whether the row is missing, named
 * differently, or on the wrong day. This renders the same comparison the
 * detector makes, with the inputs visible.
 *
 * It deliberately reuses `matchesSession` rather than reimplementing the
 * match — an audit that disagreed with the detector would be worse than none.
 */
import { sessionForDate, planWeekNumber } from "@/lib/training-plan"
import { localDateString } from "@/lib/dates"
import { exercises } from "@/data/exercises"
import type { PlanSession } from "@/data/training-plan"

export interface AuditWorkout {
  name: string
  started_at: string
  finished_at?: string | null
}

/** Days either side of the planned day that still count as doing it. */
export const MATCH_GRACE_DAYS = 1

/**
 * Names Quick Log gives a cardio workout. It names after the *exercise*
 * ("Treadmill Run"), never the plan session ("VO2 Max intervals — 4×4"), so
 * exact-title matching can never credit a quick-logged cardio session.
 *
 * Derived from the catalog rather than listed by hand, so a new cardio machine
 * is covered the day it is added.
 */
const CARDIO_WORKOUT_NAMES = new Set(
  exercises.filter((e) => e.exerciseType === "cardio").map((e) => e.name)
)

/** The session fields matching needs — anything with a title and a type. */
type MatchableSession = Pick<PlanSession, "title" | "type">

/** Whether a workout falls on the planned day, or within the grace window. */
function withinGrace(workout: AuditWorkout, day: Date): boolean {
  const a = new Date(workout.started_at)
  const diff = Math.round(
    (new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() -
      new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()) /
      86_400_000
  )
  return Math.abs(diff) <= MATCH_GRACE_DAYS
}

/**
 * Whether a logged workout counts as having done a planned session. Exported
 * so the audit and the nudge can never drift apart.
 *
 * Exact title is the confident signal, and it is all strength days need: the
 * logger names a workout from `session.title`, so Pull A and Pull B match on
 * the nose.
 *
 * Cardio days also accept any workout named after a cardio machine. Without
 * that, the app told the user twice that a session they had done was "never
 * logged" — the row was right there, under the name Quick Log gave it. A
 * detector that calls a completed session missed is worse than one that is
 * occasionally too generous: the first teaches you to distrust it, the second
 * only stays quiet.
 *
 * The accepted cost is that a short easy walk on an interval day counts as the
 * intervals. Narrowing that would mean reading each workout's duration or its
 * exercises, which is a heavier query for a case that mistakes doing something
 * for doing enough — a far cheaper error than the one it replaces.
 */
export function matchesSession(
  workout: AuditWorkout,
  session: MatchableSession,
  day: Date
): boolean {
  if (!withinGrace(workout, day)) return false
  if (workout.name === session.title) return true
  return session.type === "cardio" && CARDIO_WORKOUT_NAMES.has(workout.name)
}

export type AuditVerdict =
  | "rest"
  | "done"
  | "missing"
  /** Something was logged that day, but under a name the detector won't match. */
  | "name-mismatch"
  | "future"

export interface PlanDayAudit {
  day: string
  weekday: string
  week: number | null
  expected: string
  isRest: boolean
  /** Every workout logged on that calendar day, whatever its name. */
  logged: AuditWorkout[]
  verdict: AuditVerdict
}

/**
 * The last `days` days, newest first, each with what was prescribed, what was
 * logged, and the verdict the detector would reach.
 */
export function auditPlanDays(
  now: Date,
  days: number,
  workouts: AuditWorkout[]
): PlanDayAudit[] {
  const out: PlanDayAudit[] = []
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  for (let back = 0; back < days; back++) {
    const day = new Date(today)
    day.setDate(day.getDate() - back)
    const session = sessionForDate(day)
    const dayStr = localDateString(day)

    const loggedThatDay = workouts.filter(
      (w) => localDateString(new Date(w.started_at)) === dayStr
    )

    let verdict: AuditVerdict
    if (session.type === "rest") {
      verdict = "rest"
    } else if (workouts.some((w) => matchesSession(w, session, day))) {
      verdict = "done"
    } else if (loggedThatDay.length > 0) {
      // Something was logged, but nothing the matcher will credit — a
      // differently-named workout on a strength day. Quick-logged cardio no
      // longer lands here; it is accepted as `done`.
      verdict = "name-mismatch"
    } else {
      verdict = "missing"
    }

    out.push({
      day: dayStr,
      weekday: day.toLocaleDateString("en-US", { weekday: "short" }),
      week: planWeekNumber(day),
      expected: session.title,
      isRest: session.type === "rest",
      logged: loggedThatDay,
      verdict,
    })
  }
  return out
}
