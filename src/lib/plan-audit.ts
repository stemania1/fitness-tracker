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

export interface AuditWorkout {
  name: string
  started_at: string
  finished_at?: string | null
}

/** Days either side of the planned day that still count as doing it. */
export const MATCH_GRACE_DAYS = 1

/**
 * The detector's rule: same name, within a day either side. Exported so the
 * audit and the nudge can never drift apart.
 */
export function matchesSession(
  workout: AuditWorkout,
  title: string,
  day: Date
): boolean {
  if (workout.name !== title) return false
  const a = new Date(workout.started_at)
  const diff = Math.round(
    (new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() -
      new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()) /
      86_400_000
  )
  return Math.abs(diff) <= MATCH_GRACE_DAYS
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
    } else if (workouts.some((w) => matchesSession(w, session.title, day))) {
      verdict = "done"
    } else if (loggedThatDay.length > 0) {
      // The row exists — it just isn't named what the detector looks for.
      // Quick Log names a workout after the exercise ("Treadmill Run"), not
      // the plan session, so a quick-logged session lands here.
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
