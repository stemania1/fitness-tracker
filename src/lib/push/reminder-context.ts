import type { ReminderContext } from "@/lib/reminders"
import { daysBetweenLocalDates } from "./timezone"

/**
 * Fold the cron's per-user queries into a ReminderContext, treating a failed
 * query as "already done" rather than "not done".
 *
 * The cron builds its context from five independent DB reads. Each used to be
 * destructured straight into the context with its error ignored, so a
 * transient query failure read as "the user didn't do X" and fabricated a
 * nudge for something they'd actually logged. The dashboard already solves
 * this for loading states by feeding values that suppress each nudge; this
 * applies the same rule to query errors, and reports which queries failed so
 * the cron response can say so.
 */

/** A query result that either produced a value or failed with a message. */
export type Fallible<T> = { value: T } | { error: string }

export interface RawReminderContext {
  /** User's local hour, 0-23. */
  hour: number
  /** User's local calendar date (YYYY-MM-DD). */
  localDate: string
  /** Local date of the most recent workout, or null if none ever. */
  lastWorkoutDate: Fallible<string | null>
  /** Local date of the most recent weigh-in, or null if none ever. */
  lastWeighInDate: Fallible<string | null>
  mealsLoggedToday: Fallible<number>
  energyCheckedInToday: Fallible<boolean>
  creatineTakenToday: Fallible<boolean>
}

export interface BuiltReminderContext {
  ctx: ReminderContext
  /** Messages from failed queries (empty when everything succeeded). */
  errors: string[]
}

function unwrap<T>(f: Fallible<T>, fallback: T, errors: string[]): T {
  if ("error" in f) {
    errors.push(f.error)
    return fallback
  }
  return f.value
}

export function buildReminderContext(
  raw: RawReminderContext
): BuiltReminderContext {
  const errors: string[] = []

  // On error, pretend the workout/weigh-in happened today — a zero-day gap
  // suppresses both nudges.
  const lastWorkoutDate = unwrap(raw.lastWorkoutDate, raw.localDate, errors)
  const lastWeighInDate = unwrap(raw.lastWeighInDate, raw.localDate, errors)

  const daysSinceLastWorkout = lastWorkoutDate
    ? daysBetweenLocalDates(lastWorkoutDate, raw.localDate)
    : null

  const ctx: ReminderContext = {
    hour: raw.hour,
    mealsLoggedToday: unwrap(raw.mealsLoggedToday, 99, errors),
    workedOutToday: daysSinceLastWorkout === 0,
    daysSinceLastWorkout,
    energyCheckedInToday: unwrap(raw.energyCheckedInToday, true, errors),
    daysSinceLastWeighIn: lastWeighInDate
      ? daysBetweenLocalDates(lastWeighInDate, raw.localDate)
      : null,
    creatineTakenToday: unwrap(raw.creatineTakenToday, true, errors),
  }

  return { ctx, errors }
}
