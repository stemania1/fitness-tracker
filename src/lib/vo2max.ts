/**
 * Age- and sex-adjusted VO2 Max classification.
 *
 * Cutoffs are simplified from Cooper Institute normative data (ml/kg/min):
 * "excellent" is roughly the top ~20% for the age/sex bracket, "low" is
 * roughly the bottom ~25%. VO2 Max declines with age, so a value that is
 * merely average at 25 can be excellent at 55 — absolute cutoffs mislead
 * older users.
 */

export type Vo2MaxRating = "excellent" | "average" | "low"

interface Vo2Cutoffs {
  /** At or above this: excellent for the bracket. */
  excellent: number
  /** Below this: room to improve for the bracket. */
  low: number
}

/** Brackets keyed by inclusive max age; last entry catches everything older. */
const MALE_CUTOFFS: Array<{ maxAge: number; cutoffs: Vo2Cutoffs }> = [
  { maxAge: 29, cutoffs: { excellent: 52, low: 38 } },
  { maxAge: 39, cutoffs: { excellent: 49, low: 35 } },
  { maxAge: 49, cutoffs: { excellent: 46, low: 32 } },
  { maxAge: 59, cutoffs: { excellent: 42, low: 29 } },
  { maxAge: Infinity, cutoffs: { excellent: 38, low: 26 } },
]

const FEMALE_CUTOFFS: Array<{ maxAge: number; cutoffs: Vo2Cutoffs }> = [
  { maxAge: 29, cutoffs: { excellent: 44, low: 31 } },
  { maxAge: 39, cutoffs: { excellent: 41, low: 29 } },
  { maxAge: 49, cutoffs: { excellent: 38, low: 27 } },
  { maxAge: 59, cutoffs: { excellent: 34, low: 24 } },
  { maxAge: Infinity, cutoffs: { excellent: 31, low: 22 } },
]

/** Legacy absolute cutoffs, used when age is unknown. */
const DEFAULT_CUTOFFS: Vo2Cutoffs = { excellent: 50, low: 35 }

export type Sex = "male" | "female" | "other" | null | undefined

function cutoffsFor(age: number | null | undefined, sex: Sex): Vo2Cutoffs {
  if (age == null || !Number.isFinite(age) || age < 13) return DEFAULT_CUTOFFS
  const male = MALE_CUTOFFS.find((b) => age <= b.maxAge)!.cutoffs
  const female = FEMALE_CUTOFFS.find((b) => age <= b.maxAge)!.cutoffs
  if (sex === "male") return male
  if (sex === "female") return female
  // Unknown/other: midpoint of the male and female bands.
  return {
    excellent: (male.excellent + female.excellent) / 2,
    low: (male.low + female.low) / 2,
  }
}

/**
 * Classify a VO2 Max reading relative to the user's age/sex bracket.
 * Falls back to absolute cutoffs (50 / 35) when age is unknown.
 */
export function classifyVo2Max(
  vo2Max: number,
  age: number | null | undefined,
  sex: Sex
): Vo2MaxRating {
  const { excellent, low } = cutoffsFor(age, sex)
  if (vo2Max >= excellent) return "excellent"
  if (vo2Max < low) return "low"
  return "average"
}
