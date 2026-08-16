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

import {
  defaultReminderSettings,
  isQuietHour,
  type ReminderSettings,
} from "./reminder-settings"
import { stepPace, ACTIVE_DAY_END_HOUR } from "./daily-movement"

export type ReminderType =
  | "log_workout"
  | "log_meal"
  | "energy_checkin"
  | "log_weight"
  | "log_creatine"
  | "step_goal"

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
  /** Has creatine been logged today? */
  creatineTakenToday: boolean
  /**
   * Steps so far today, or null when we don't know — no ring connected, or
   * the day's activity hasn't been read yet. Null suppresses the nudge:
   * "you've walked 0 steps" is a very different claim from "we have no step
   * data", and only one of them is worth a notification.
   */
  stepsToday: number | null
  /** The user's daily step target. */
  stepGoal: number
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
/**
 * Hour after which evening nudges (dinner, energy) make sense.
 *
 * Exported because it is the latest gate any reminder has, which makes it the
 * earliest hour at which the whole day's set is knowable — the push sender
 * needs that to decide when to compose its one notification.
 */
export const EVENING = 18
/** A workout gap of this many days is worth a nudge. */
const WORKOUT_GAP_DAYS = 3
/**
 * Earliest hour for the step nudge.
 *
 * Deliberately later than the pace maths alone would allow. Being behind at
 * 09:00 means almost nothing — a single walk erases it — so a nudge that
 * early is noise, and a category that nags without cause is the one users
 * switch off. Mid-afternoon is the first point at which "behind" is likely
 * to still be true at bedtime.
 */
const STEP_NUDGE_HOUR = 15
/** Weigh-in cadence. */
const WEIGH_IN_DAYS = 7

/**
 * Compute the active reminders for the given moment, most urgent first.
 * Honors the user's settings (master switch, per-category toggles, quiet
 * hours) and returns at most `max` (default 3) so the surface stays a nudge,
 * not a wall.
 */
export function computeReminders(
  ctx: ReminderContext,
  settings: ReminderSettings = defaultReminderSettings(),
  max = 3
): Reminder[] {
  // Master switch off, or inside quiet hours → nothing at all.
  if (!settings.enabled) return []
  if (isQuietHour(ctx.hour, settings.quietStartHour, settings.quietEndHour)) {
    return []
  }

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

  // Steps behind pace, while there is still daylight to fix it.
  //
  // Bounded at both ends: nothing before mid-afternoon (see STEP_NUDGE_HOUR),
  // and nothing once the moving day is over — at 22:30 "you're 4,000 steps
  // short" is a verdict, not a nudge, and there is nothing the user can do
  // with it except feel bad.
  if (
    ctx.stepsToday != null &&
    ctx.hour >= STEP_NUDGE_HOUR &&
    ctx.hour < ACTIVE_DAY_END_HOUR
  ) {
    const pace = stepPace(ctx.stepsToday, ctx.stepGoal, ctx.hour)
    if (pace.status === "behind") {
      out.push({
        type: "step_goal",
        priority: 50,
        title: `${pace.remaining.toLocaleString()} steps short of your goal`,
        detail: `${pace.value.toLocaleString()} so far today — a 15-minute walk closes most of the gap.`,
      })
    }
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

  // Daily creatine — a gentle evening nudge if it hasn't been logged, since
  // consistency is what makes it work.
  if (!ctx.creatineTakenToday && ctx.hour >= EVENING) {
    out.push({
      type: "log_creatine",
      priority: 35,
      title: "Haven't logged creatine today",
      detail: "A daily dose keeps your levels topped up — mark it once you've taken it.",
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

  return out
    .filter((r) => settings.types[r.type] !== false)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, max)
}
