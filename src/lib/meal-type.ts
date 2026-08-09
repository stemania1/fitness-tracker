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
 * Drinks, by the words that name one. Not exhaustive and never will be — it
 * only has to beat "whatever the clock says", which for an 8am latte was
 * "breakfast".
 */
const DRINK_WORDS =
  /\b(coffee|latte|cappuccino|espresso|americano|macchiato|mocha|cortado|flat white|frappuccino|frapp[eé]|cold brew|tea|chai|matcha|juice|smoothie|milkshake|shake|soda|cola|coke|pepsi|lemonade|kombucha|seltzer|sparkling water|water|beer|wine|cider|cocktail|margarita|hot chocolate|cocoa|energy drink|red bull|monster|celsius|gatorade|kool[\s-]?aid)\b/i

/**
 * The head of a description — everything before the first "with"/","/"(" and
 * friends. "Pancakes with orange juice" is a breakfast that happens to
 * mention a drink; "Cappuccino/latte with milk foam in a mug" is a drink. The
 * difference is which one the description leads with.
 */
function head(description: string): string {
  return description.split(/\bwith\b|[,;+(]/i)[0]
}

/**
 * Does this description name a drink rather than something eaten?
 *
 * Deliberately shallow: it reads the head of the description only, so a meal
 * that mentions a beverage in passing stays a meal. A drink listed after the
 * food it came with ("Eggs and a coffee") reads as the food, which is the
 * right way round to be wrong — the label is a starting point, not a verdict.
 */
export function looksLikeDrink(description: string | null | undefined): boolean {
  if (!description) return false
  return DRINK_WORDS.test(head(description))
}

/**
 * What the meal-type select should open on for a meal logged at `loggedAt`
 * (a `datetime-local` "YYYY-MM-DDTHH:mm", the shape the backdating chips hand
 * around).
 *
 * A drink is never named for the time of day — an 8am latte is not breakfast,
 * however much it may be standing in for one. `knownDrink` lets a caller pass
 * a stronger signal than the wording, e.g. that the caffeine table (which is
 * drinks-only by design) recognized the item by brand name.
 */
export function defaultMealType(
  loggedAt: string,
  opts: { description?: string | null; knownDrink?: boolean } = {}
): MealType {
  if (opts.knownDrink || looksLikeDrink(opts.description)) return "snack"
  const m = loggedAt.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}/)
  if (!m) return "meal"
  return mealTypeForHour(Number(m[1]))
}
