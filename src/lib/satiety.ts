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
 * Hunger can also be logged on its own, with no meal attached, and those
 * ratings are folded into the same timeline. They are often the better
 * evidence: a meal that failed announces itself as hunger arriving long
 * before you next sit down to eat, and a rating that can only be given at
 * mealtimes structurally cannot see that. "Starving at 10:30" and "moderately
 * hungry at noon, when I happened to eat" are different facts about the same
 * breakfast.
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

/**
 * The hunger scale, in words. 1 (still full) to 5 (ravenous), worded as
 * states rather than numbers so the answer needs no calibration — "ravenous"
 * means the same thing in March as in August, where "4 out of 5" drifts.
 *
 * Shared by every place hunger is captured. Two screens asking the same
 * question in different words would produce two incomparable columns of data
 * that the analysis then averages together.
 */
export const HUNGER_LEVELS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: "Still full" },
  { value: 2, label: "Satisfied" },
  { value: 3, label: "Ready" },
  { value: 4, label: "Hungry" },
  { value: 5, label: "Ravenous" },
]

/** A hunger rating recorded on its own, with no meal attached. */
export interface HungerObservation {
  /** ISO timestamp the rating was given. */
  loggedAt: string
  /** 1 (still full) … 5 (ravenous) — the same scale as preMealHunger. */
  level: number
}

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

/** A rating on the merged timeline, wherever it came from. */
interface RatingEvent {
  at: number
  level: number
}

/**
 * Pair each meal with the first hunger rating that follows it.
 *
 * The endpoint may be the rating attached to the next meal, or a standalone
 * one given in between — whichever came first. Earliest wins because it is
 * the more informative reading: it is closer to when hunger actually arrived,
 * and it is unprompted by the act of eating.
 *
 * Nothing after the next meal is eligible. Once you have eaten again, your
 * hunger is about that meal, not this one — so a meal whose successor went
 * unrated, with no standalone rating in between, simply yields nothing. The
 * interval is unmeasured, and treating unmeasured as neutral would drag every
 * average toward the middle.
 */
export function satietyIntervals(
  meals: RatedMeal[],
  standalone: HungerObservation[] = []
): SatietyInterval[] {
  const ordered = [...meals]
    .map((m) => ({ meal: m, at: new Date(m.loggedAt).getTime() }))
    .filter((m) => Number.isFinite(m.at))
    .sort((a, b) => a.at - b.at)

  const loose: RatingEvent[] = standalone
    .map((o) => ({ at: new Date(o.loggedAt).getTime(), level: o.level }))
    .filter((o) => Number.isFinite(o.at))
    .sort((a, b) => a.at - b.at)

  const out: SatietyInterval[] = []

  for (let i = 0; i < ordered.length; i++) {
    const { meal, at } = ordered[i]
    const next = ordered[i + 1]

    // Candidates strictly after this meal and no later than the next one.
    // The next meal's own rating lands exactly on its timestamp and describes
    // this gap, so that boundary is inclusive.
    const candidates: RatingEvent[] = []
    if (next?.meal.preMealHunger != null) {
      candidates.push({ at: next.at, level: next.meal.preMealHunger })
    }
    for (const o of loose) {
      if (o.at <= at) continue
      if (next && o.at > next.at) break
      candidates.push(o)
    }
    if (candidates.length === 0) continue

    const endpoint = candidates.reduce((a, b) => (b.at < a.at ? b : a))
    const gapHours = (endpoint.at - at) / 3_600_000
    if (gapHours < MIN_GAP_HOURS || gapHours > MAX_GAP_HOURS) continue

    out.push({
      mealId: meal.id,
      description: meal.description,
      calories: meal.calories,
      proteinG: meal.proteinG,
      gapHours,
      hungerAfter: endpoint.level,
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
  /** Hunger ratings logged on their own. */
  standalone: number
  /** Rated intervals inside the comparable gap band. */
  comparable: number
  /** Still needed before the analysis will say anything. */
  needed: number
}

export function satietyCoverage(
  meals: RatedMeal[],
  intervals: SatietyInterval[],
  standalone: HungerObservation[] = []
): SatietyCoverage {
  const comparable = intervals.length
  return {
    meals: meals.length,
    rated: meals.filter((m) => m.preMealHunger != null).length,
    standalone: standalone.length,
    comparable,
    needed: Math.max(0, MIN_RATED_INTERVALS - comparable),
  }
}
