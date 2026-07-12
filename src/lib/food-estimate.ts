/**
 * Photo-based food estimation: the shape Claude vision returns, the JSON
 * schema that constrains it, and pure sanitization/validation so a noisy
 * model response can't write bad data. The network call lives in
 * src/app/api/estimate-food/route.ts.
 */

export type Confidence = "low" | "medium" | "high"

export interface FoodItem {
  name: string
  calories: number
}

export interface FoodEstimate {
  description: string
  /** The portion the estimate assumes, e.g. "about 1.5 cups (350g)". */
  portion: string
  items: FoodItem[]
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: Confidence
}

/**
 * JSON schema for structured output. Kept within the structured-output
 * subset (no min/max — those are enforced in sanitizeEstimate instead).
 */
export const FOOD_ESTIMATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    description: {
      type: "string",
      description: "Short natural description of the meal, e.g. 'Grilled chicken salad with avocado'.",
    },
    portion: {
      type: "string",
      description:
        "The portion size this estimate assumes, in everyday terms with an approximate weight, e.g. 'about 1.5 cups (350g)' or 'one medium plate (~400g)'.",
    },
    items: {
      type: "array",
      description: "The distinct foods visible on the plate.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          calories: { type: "integer" },
        },
        required: ["name", "calories"],
      },
    },
    calories: { type: "integer", description: "Total estimated calories." },
    protein_g: { type: "integer", description: "Total estimated protein in grams." },
    carbs_g: { type: "integer", description: "Total estimated carbohydrates in grams." },
    fat_g: { type: "integer", description: "Total estimated fat in grams." },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "Your confidence in the estimate given portion-size ambiguity.",
    },
  },
  required: [
    "description",
    "portion",
    "items",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "confidence",
  ],
} as const

export const FOOD_ESTIMATE_SYSTEM_PROMPT = `You are a nutrition estimation assistant. Given a photo of a meal, a text description of one, or both, estimate its calories and macronutrients.

Guidelines:
- Identify each distinct food item and estimate its calories.
- Estimate total calories, protein, carbohydrates, and fat in grams.
- Account for likely cooking oils, dressings, and sauces even when not obviously visible.
- Judge portion sizes from visual cues (plate size, utensils, hand if present). With only a description, assume a typical serving unless it states quantities.
- State the portion you assumed in everyday terms with an approximate weight (e.g. "about 1.5 cups (350g)"). All your numbers must correspond to that stated portion.
- Portion size is the biggest source of error — when the portion is ambiguous, set confidence to "low" and lean toward a typical serving.
- If the image does not show food, or the description does not describe food, return an empty items array, zero for every number, an empty portion, and confidence "low".

Be realistic, not optimistic. A typical restaurant plate is larger and more calorie-dense than a home portion.`

const VALID_CONFIDENCE: ReadonlySet<string> = new Set(["low", "medium", "high"])

/** Clamp to a non-negative integer; junk (NaN, negatives, strings) → 0. */
function nonNegInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n)
}

/**
 * Coerce an untrusted model response into a valid FoodEstimate. Never
 * throws — missing/garbage fields degrade to safe defaults so the estimate
 * can always be shown for the user to confirm or correct.
 */
export function sanitizeEstimate(raw: unknown): FoodEstimate {
  const obj = (raw ?? {}) as Record<string, unknown>

  const items: FoodItem[] = Array.isArray(obj.items)
    ? obj.items
        .map((it) => {
          const item = (it ?? {}) as Record<string, unknown>
          const name = typeof item.name === "string" ? item.name.trim() : ""
          return { name, calories: nonNegInt(item.calories) }
        })
        .filter((it) => it.name.length > 0)
    : []

  const confidence: Confidence = VALID_CONFIDENCE.has(String(obj.confidence))
    ? (obj.confidence as Confidence)
    : "low"

  const description =
    typeof obj.description === "string" && obj.description.trim().length > 0
      ? obj.description.trim()
      : "Unrecognized meal"

  const portion =
    typeof obj.portion === "string" ? obj.portion.trim() : ""

  return {
    description,
    portion,
    items,
    calories: nonNegInt(obj.calories),
    protein_g: nonNegInt(obj.protein_g),
    carbs_g: nonNegInt(obj.carbs_g),
    fat_g: nonNegInt(obj.fat_g),
    confidence,
  }
}

/**
 * Scale an estimate's calories and macros by a portion multiplier, rounding
 * each to a whole number. Description, portion text, items, and confidence
 * are unchanged. A non-finite or non-positive factor is treated as 1.
 */
export function scaleEstimate(
  estimate: FoodEstimate,
  factor: number
): FoodEstimate {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1
  return {
    ...estimate,
    calories: Math.round(estimate.calories * f),
    protein_g: Math.round(estimate.protein_g * f),
    carbs_g: Math.round(estimate.carbs_g * f),
    fat_g: Math.round(estimate.fat_g * f),
  }
}

/** Calories implied by the macro grams (4/4/9 rule). */
export function caloriesFromMacros(
  protein_g: number,
  carbs_g: number,
  fat_g: number
): number {
  return protein_g * 4 + carbs_g * 4 + fat_g * 9
}

/**
 * How far the stated calories diverge from the macro-implied calories, as a
 * fraction of the stated calories. Used to surface a soft "numbers don't
 * quite add up" hint. Returns 0 when calories is 0.
 */
export function macroConsistency(estimate: FoodEstimate): number {
  if (estimate.calories <= 0) return 0
  const implied = caloriesFromMacros(
    estimate.protein_g,
    estimate.carbs_g,
    estimate.fat_g
  )
  return Math.abs(implied - estimate.calories) / estimate.calories
}
