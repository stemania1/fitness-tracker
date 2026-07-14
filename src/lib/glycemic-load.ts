/**
 * Glycemic-load classification for the "glucose impact" guidance on
 * logged meals. GL is a property of the food (carb grams x glycemic
 * index / 100) — deliberately NOT an estimate of the user's blood
 * glucose, which can't honestly be computed from food logs.
 *
 * Thresholds are the conventional ones from the GI/GL literature:
 * per meal/serving GL <=10 low, 11-19 medium, >=20 high; per day
 * <80 low, 80-120 medium, >120 high.
 */

export type GlImpact = "low" | "medium" | "high"

/** Classify a single meal's glycemic load. */
export function classifyMealGl(gl: number): GlImpact {
  if (!Number.isFinite(gl) || gl < 0) return "low"
  if (gl >= 20) return "high"
  if (gl >= 11) return "medium"
  return "low"
}

/** Classify a whole day's summed glycemic load. */
export function classifyDailyGl(totalGl: number): GlImpact {
  if (!Number.isFinite(totalGl) || totalGl < 0) return "low"
  if (totalGl > 120) return "high"
  if (totalGl >= 80) return "medium"
  return "low"
}

/**
 * The one activity lever with solid evidence behind it — shown alongside
 * high-impact meals.
 */
export const GL_WALK_TIP =
  "A 10-15 min walk within an hour of eating blunts the spike from high-impact meals."
