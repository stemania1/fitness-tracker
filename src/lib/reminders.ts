/**
 * Smart in-app reminders: turn the day's actual state into a short,
 * prioritized list of "you forgot to log X" nudges, surfaced when the user
 * opens the app.
 *
 * Everything is time-gated so a reminder never fires prematurely (no
 * "log your dinner" at 8am), and everything is derived from data the
 * dashboard already has — no push infrastructure, no new tables.
 *
 * Pure and deterministic: all time inputs (the current hour, day-gaps) are
 * passed in, so the engine is fully testable and callers stay in control of
 * "now".
 */

export type ReminderType =
  | "log_workout"
  | "log_meal"
  | "energy_checkin"
  | "log_weight"

export interface ReminderContext {
  /** Local hour of day, 0-23. */
  hour: number
  /** Meals logged so far today. */
  mealsLoggedToday: number
  /** Has a workout been logged today? */
  workedOutToday: boolean
  /** Whole days since the last logged workout; null if none ever. */
  daysSinceLastWorkout: number | null
  /** Has today's energy check-in been done? */
  energyCheckedInToday: boolean
  /** Whole days since the last weigh-in; null if none ever. */
  daysSinceLastWeighIn: number | null
}

export interface Reminder {
  type: ReminderType
  /** Higher sorts first. */
  priority: number
  title: string
  detail: string
}

/** Hour after which a missing-meal nudge makes sense (past lunch). */
const AFTERNOON = 14
/** Hour after which evening nudges (dinner, energy) make sense. */
const EVENING = 18
/** A workout gap of this many days is worth a nudge. */
const WORKOUT_GAP_DAYS = 3
/** Weigh-in cadence. */
const WEIGH_IN_DAYS = 7

/**
 * Compute the active reminders for the given moment, most urgent first.
 * Returns at most `max` (default 3) so the surface stays a nudge, not a wall.
 */
export function computeReminders(
  ctx: ReminderContext,
  max = 3
): Reminder[] {
  const out: Reminder[] = []

  // Workout gap — the most consequential miss.
  if (
    !ctx.workedOutToday &&
    ctx.daysSinceLastWorkout != null &&
    ctx.daysSinceLastWorkout >= WORKOUT_GAP_DAYS
  ) {
    const d = ctx.daysSinceLastWorkout
    out.push({
      type: "log_workout",
      priority: 80,
      title: `It's been ${d} days since your last workout`,
      detail: "A short session still counts — start one to keep the streak alive.",
    })
  }

  // Meal logging — the user's stated pain point.
  if (ctx.hour >= AFTERNOON && ctx.mealsLoggedToday === 0) {
    out.push({
      type: "log_meal",
      priority: 65,
      title: "No meals logged yet today",
      detail: "Snap a meal so your calories and macros stay accurate.",
    })
  } else if (ctx.hour >= EVENING + 2 && ctx.mealsLoggedToday < 2) {
    out.push({
      type: "log_meal",
      priority: 55,
      title: "Log your dinner before bed",
      detail: "Catch tonight's meal while you still remember what it was.",
    })
  }

  // Evening energy check-in.
  if (!ctx.energyCheckedInToday && ctx.hour >= EVENING) {
    out.push({
      type: "energy_checkin",
      priority: 40,
      title: "How's your energy today?",
      detail: "A quick check-in sharpens tomorrow's read.",
    })
  }

  // Weekly weigh-in.
  if (ctx.daysSinceLastWeighIn == null || ctx.daysSinceLastWeighIn >= WEIGH_IN_DAYS) {
    out.push({
      type: "log_weight",
      priority: 30,
      title:
        ctx.daysSinceLastWeighIn == null
          ? "Log your first weigh-in"
          : "Time for a weekly weigh-in",
      detail: "Regular weigh-ins keep your goal projection honest.",
    })
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, max)
}
