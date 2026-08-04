/**
 * Rescaling a logged meal to the portion actually eaten. A photo estimate
 * describes the plate in front of you; eating half of it should halve the
 * numbers rather than force a re-log. Every nutrient scales linearly with the
 * portion, including glycemic load (GL is proportional to the carbs consumed).
 *
 * Pure so it's unit-tested; the meal card applies the result as an update.
 */

/** The nutrient fields that scale with portion size. */
export interface MealNutrients {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sugar_g: number
  glycemic_load: number
}

/** Portion presets offered on the card, as fractions of what was logged. */
export const PORTION_OPTIONS = [
  { label: "¼", factor: 0.25 },
  { label: "½", factor: 0.5 },
  { label: "¾", factor: 0.75 },
  { label: "1½", factor: 1.5 },
  { label: "2×", factor: 2 },
]

/** Round to a sensible precision: calories whole, macros to one decimal. */
function roundCalories(n: number): number {
  return Math.round(n)
}
function roundGrams(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Scale a meal's nutrients by `factor` (0.5 = ate half). Guards against a
 * non-positive factor, and treats missing nutrients as 0 so a partially
 * filled estimate still rescales cleanly.
 */
export function scaleMealNutrients(
  meal: Partial<MealNutrients>,
  factor: number
): MealNutrients {
  const f = factor > 0 ? factor : 1
  return {
    calories: roundCalories((meal.calories ?? 0) * f),
    protein_g: roundGrams((meal.protein_g ?? 0) * f),
    carbs_g: roundGrams((meal.carbs_g ?? 0) * f),
    fat_g: roundGrams((meal.fat_g ?? 0) * f),
    sugar_g: roundGrams((meal.sugar_g ?? 0) * f),
    glycemic_load: roundGrams((meal.glycemic_load ?? 0) * f),
  }
}

/** The "½ of …" prefix `describePortion` writes onto a rescaled meal. */
const PORTION_PREFIX = /^\s*(¼|½|¾|1½|2×)\s+of\s+/i

/**
 * Split a rescaled description back into its multiplier and the original
 * text: "½ of 32 oz Dr Pepper" → `{ factor: 0.5, base: "32 oz Dr Pepper" }`.
 * An unprefixed description is a 1× serving of itself.
 *
 * Anything reading quantities out of a description needs this — the volume in
 * "½ of 32 oz Dr Pepper" is what was poured, not what was drunk, so taking
 * the 32 at face value doubles the answer.
 */
export function parsePortionPrefix(description: string): {
  factor: number
  base: string
} {
  const match = description.match(PORTION_PREFIX)
  if (!match) return { factor: 1, base: description }
  const preset = PORTION_OPTIONS.find((p) => p.label === match[1])
  return {
    factor: preset?.factor ?? 1,
    base: description.replace(PORTION_PREFIX, ""),
  }
}

/**
 * A description reflecting the portion actually eaten, so the log doesn't
 * still read like a full plate. Existing portion prefixes are replaced rather
 * than stacked, so rescaling twice doesn't produce "½ of ½ of …".
 */
export function describePortion(
  description: string,
  factor: number
): string {
  const { base } = parsePortionPrefix(description)
  const preset = PORTION_OPTIONS.find((p) => p.factor === factor)
  if (!preset || factor === 1) return base
  return `${preset.label} of ${base}`
}
