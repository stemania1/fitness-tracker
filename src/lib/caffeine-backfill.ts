/**
 * Deciding which already-logged meals should get a caffeine row.
 *
 * Meals logged before Snap Meal offered caffeine contribute zero milligrams,
 * so a 32 oz Dr Pepper from last month is invisible to the energy read and
 * the sleep warning. Backfilling means writing rows into days the user
 * already lived, where a wrong row is worse than a missing one — so the rules
 * are conservative, and they live here, tested, rather than inside the
 * one-off script that runs them (`scripts/backfill-meal-caffeine.ts`).
 */

// Explicit .ts extensions, unlike the rest of src/: this module is also
// imported by scripts/backfill-meal-caffeine.ts, which runs under plain Node
// (--experimental-strip-types) rather than a bundler, and Node's ESM resolver
// will not guess an extension. Bundlers and vitest resolve these fine — don't
// "tidy" them away, it breaks the script.
import { lookupCaffeine } from "./caffeine-foods.ts"
import { parsePortionPrefix } from "./meal-portion.ts"

/**
 * A caffeine log this close to a meal is assumed to be that same drink,
 * logged by hand at the time. Wide enough to cover logging the drink when you
 * sat down and the meal when you finished; narrow enough that the morning
 * coffee doesn't suppress a lunchtime soda.
 */
export const DUPLICATE_WINDOW_MIN = 90

export interface BackfillMeal {
  id: string
  user_id: string
  description: string
  logged_at: string
}

export interface BackfillDose {
  mg: number
  logged_at: string
  user_id: string
  /** Null for a drink logged on its own through Log Caffeine. */
  source_food_log_id: string | null
}

export interface PlannedDose {
  meal: BackfillMeal
  mg: number
  /** The drink the table matched, for showing where the number came from. */
  label: string
}

export interface SkippedMeal {
  meal: BackfillMeal
  reason: string
}

export interface BackfillPlan {
  planned: PlannedDose[]
  skipped: SkippedMeal[]
}

function minutesApart(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 60000
}

/**
 * Work out which meals need a caffeine row, and which are deliberately left
 * alone. Pure: it reads the two histories and returns the plan, so the script
 * can print it before anything is written.
 *
 * A meal is planned only when the table recognizes the drink **by name**. The
 * model's own caffeine estimate isn't available retroactively — it was never
 * stored — and inferring one now from a description would put invented
 * milligrams on real days. Unrecognized meals are dropped silently rather
 * than reported: on a normal history that's nearly everything.
 */
export function planCaffeineBackfill(
  meals: BackfillMeal[],
  existing: BackfillDose[]
): BackfillPlan {
  const linked = new Set(
    existing
      .map((d) => d.source_food_log_id)
      .filter((id): id is string => id !== null)
  )
  const handLogged = existing.filter((d) => d.source_food_log_id === null)

  const planned: PlannedDose[] = []
  const skipped: SkippedMeal[] = []

  for (const meal of meals) {
    // Re-running must be safe: a meal that already has its dose is done.
    if (linked.has(meal.id)) {
      skipped.push({ meal, reason: "already has a linked dose" })
      continue
    }

    // "½ of 32 oz Dr Pepper" is half a 32 oz drink, not a 32 oz one — the
    // volume in the text is what was poured, not what was drunk.
    const { factor, base } = parsePortionPrefix(meal.description)
    const known = lookupCaffeine(base)
    if (!known) continue

    const mg = Math.round(known.mg * factor)
    if (mg <= 0) {
      skipped.push({ meal, reason: `${known.label} has no caffeine` })
      continue
    }

    // Logging the same drink twice — once as a meal, once through Log
    // Caffeine — is precisely the workaround this feature replaced, so the
    // old history is full of pairs. Backfilling over one would double it.
    const near = handLogged.find(
      (d) =>
        d.user_id === meal.user_id &&
        minutesApart(d.logged_at, meal.logged_at) <= DUPLICATE_WINDOW_MIN
    )
    if (near) {
      skipped.push({
        meal,
        reason: `${near.mg}mg already logged by hand within ${DUPLICATE_WINDOW_MIN}min`,
      })
      continue
    }

    planned.push({ meal, mg, label: known.label })
  }

  return { planned, skipped }
}

/**
 * The rows a plan writes. Shaped to match what Snap Meal inserts, so a
 * backfilled dose is indistinguishable from one logged with its meal —
 * including landing at the meal's own time, which is what the "still active"
 * and late-caffeine reads work from.
 */
export function backfillRows(planned: PlannedDose[]): Array<{
  user_id: string
  mg: number
  source: string
  source_food_log_id: string
  logged_at: string
}> {
  return planned.map((p) => ({
    user_id: p.meal.user_id,
    mg: p.mg,
    source: p.meal.description.slice(0, 80),
    source_food_log_id: p.meal.id,
    logged_at: p.meal.logged_at,
  }))
}
