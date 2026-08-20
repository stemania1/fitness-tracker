/**
 * Meal satiety: which meals actually hold you.
 *
 * Calorie counting says how much you ate. It says nothing about which meals
 * leave you raiding the cupboard ninety minutes later, which is the thing
 * that actually decides whether a deficit is sustainable.
 *
 * The measurement rides an action already being taken. Each meal log carries
 * `pre_meal_hunger` — how hungry you were *before* eating — and that rating
 * describes the end of the gap since the meal before it. So a rating on meal
 * N is evidence about meal N−1's staying power. Nothing has to be remembered
 * or answered later.
 *
 * ## Why the gap has to be controlled
 *
 * Being ravenous six hours after eating is unremarkable; being ravenous
 * ninety minutes after eating is the finding. Without holding the gap
 * roughly constant, any comparison between meals just rediscovers that long
 * gaps make people hungry — a fact about clocks, not about food.
 *
 * So intervals outside a comparable band are excluded rather than adjusted.
 * Adjusting would require a hunger-versus-time curve this app has no way to
 * fit from a handful of points per day.
 *
 * Pure so it's unit-tested; the card supplies meals from `food_logs`.
 */

/** A logged meal, in the shape the analysis needs. */
export interface RatedMeal {
  id: string
  /** ISO timestamp the meal was eaten. */
  loggedAt: string
  description: string
  calories: number
  proteinG: number
  /** Null when the meal predates the rating, or it was skipped. */
  preMealHunger: number | null
}

/** One meal paired with how hungry you were when you next ate. */
export interface SatietyInterval {
  /** The meal being judged. */
  mealId: string
  description: string
  calories: number
  proteinG: number
  /** Hours until the next meal. */
  gapHours: number
  /** Hunger at the end of the gap, 1 (still full) … 5 (ravenous). */
  hungerAfter: number
}

/**
 * The gap band an interval must fall in to be comparable.
 *
 * Under two hours is grazing rather than a meal-to-meal interval, and a
 * rating there mostly reflects that you had barely finished eating. Over six
 * hours, hunger is a foregone conclusion whatever you ate.
 */
export const MIN_GAP_HOURS = 2
export const MAX_GAP_HOURS = 6

/** Intervals needed before any comparison is worth reporting. */
export const MIN_RATED_INTERVALS = 12

/**
 * Pair each meal with the hunger rating given at the next one.
 *
 * Only consecutive meals count. A gap spanning overnight, or one where the
 * next meal went unrated, yields nothing — the interval is unmeasured, and
 * treating unmeasured as neutral would drag every average toward the middle.
 */
export function satietyIntervals(meals: RatedMeal[]): SatietyInterval[] {
  const ordered = [...meals].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
  const out: SatietyInterval[] = []

  for (let i = 0; i < ordered.length - 1; i++) {
    const meal = ordered[i]
    const next = ordered[i + 1]
    if (next.preMealHunger == null) continue

    const gapHours =
      (new Date(next.loggedAt).getTime() - new Date(meal.loggedAt).getTime()) /
      3_600_000
    if (!Number.isFinite(gapHours)) continue
    if (gapHours < MIN_GAP_HOURS || gapHours > MAX_GAP_HOURS) continue

    out.push({
      mealId: meal.id,
      description: meal.description,
      calories: meal.calories,
      proteinG: meal.proteinG,
      gapHours,
      hungerAfter: next.preMealHunger,
    })
  }

  return out
}

/** How many comparable intervals exist, and how far off reporting we are. */
export interface SatietyCoverage {
  /** Meals supplied. */
  meals: number
  /** Meals carrying a hunger rating. */
  rated: number
  /** Rated intervals inside the comparable gap band. */
  comparable: number
  /** Still needed before the analysis will say anything. */
  needed: number
}

export function satietyCoverage(
  meals: RatedMeal[],
  intervals: SatietyInterval[]
): SatietyCoverage {
  const comparable = intervals.length
  return {
    meals: meals.length,
    rated: meals.filter((m) => m.preMealHunger != null).length,
    comparable,
    needed: Math.max(0, MIN_RATED_INTERVALS - comparable),
  }
}
