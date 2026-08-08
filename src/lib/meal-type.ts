/**
 * Naming a meal from the clock.
 *
 * Snap Meal used to open with the meal type pinned to "meal", so a morning egg
 * had to be reclassified as breakfast on every single log. The type is still
 * the user's to set — this only decides what the select starts on.
 *
 * Pure, and keyed on an hour rather than "now", so a backdated meal is named
 * for when it was eaten rather than when it was typed in.
 */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "meal"

/** Selectable meal types, in display order. */
export const MEAL_TYPES: MealType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "meal",
]

/**
 * Boundaries, as the first hour that is no longer the previous meal. Late
 * night belongs to `snack` at both ends of the day: food at 1am is the same
 * kind of eating as food at 11pm, not an early breakfast.
 */
const LATE_NIGHT_ENDS = 4
const BREAKFAST_ENDS = 11
const LUNCH_ENDS = 16
const DINNER_ENDS = 21

/** The meal type a given local hour (0-23) most likely belongs to. */
export function mealTypeForHour(hour: number): MealType {
  // A caller with a broken clock gets the neutral label rather than a guess.
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return "meal"
  if (hour < LATE_NIGHT_ENDS) return "snack"
  if (hour < BREAKFAST_ENDS) return "breakfast"
  if (hour < LUNCH_ENDS) return "lunch"
  if (hour < DINNER_ENDS) return "dinner"
  return "snack"
}

/**
 * The meal type for a `datetime-local` value ("YYYY-MM-DDTHH:mm") — the shape
 * the backdating chips hand around. Falls back to "meal" if it can't be read.
 */
export function mealTypeForLocalDatetime(value: string): MealType {
  const m = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}/)
  if (!m) return "meal"
  return mealTypeForHour(Number(m[1]))
}
