/**
 * Recommended daily calorie and macro targets from the user's profile.
 *
 * Method: Mifflin-St Jeor BMR (the ADA-preferred estimate for healthy
 * adults), scaled by an activity factor derived from the profile's
 * workout-days setting, then adjusted for the primary goal:
 *
 *   lose_weight       -500 cal/day (~1 lb/week), floored at a safe minimum
 *   build_muscle      +300 cal/day lean surplus
 *   improve_endurance maintenance, carb-forward split
 *   general_fitness   maintenance
 *
 * Protein is set in g per lb of body weight by goal (target weight on a
 * cut, so the target doesn't inflate with the weight being lost), fat as
 * a percentage of calories with a 0.3 g/lb floor, and carbs get the
 * remaining calories. These are population estimates for guidance, not
 * medical advice — same caveat as the heart-rate zones.
 */

export interface MacroTargetInputs {
  age: number | null
  sex: "male" | "female" | "other" | null
  height_inches: number | null
  current_weight: number | null
  primary_goal:
    | "lose_weight"
    | "build_muscle"
    | "improve_endurance"
    | "general_fitness"
    | null
  target_weight: number | null
  workout_days: number | null
}

export interface MacroTargets {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  /**
   * Daily sugar ceiling (grams), not a target to hit: WHO's free-sugars
   * guideline of <10% of energy intake, converted at 4 cal/g. Logged
   * sugars include natural ones (fruit, dairy), so this is a soft line.
   */
  sugar_limit_g: number
  /** Human-readable basis for the calorie target, e.g. for a card footer. */
  goalNote: string
}

const KG_PER_LB = 0.45359237
const CM_PER_INCH = 2.54

/** Same sanity bounds as heart-rate.ts. */
const MIN_AGE = 13
const MAX_AGE = 100

/**
 * Mifflin-St Jeor BMR in kcal/day. Sex "other" uses the midpoint of the
 * male/female constants. Returns null on missing or implausible inputs.
 */
export function estimateBmr(
  inputs: Pick<MacroTargetInputs, "age" | "sex" | "height_inches" | "current_weight">
): number | null {
  const { age, sex, height_inches: heightIn, current_weight: weightLbs } = inputs
  if (age == null || sex == null || heightIn == null || weightLbs == null) return null
  if (!Number.isFinite(age) || age < MIN_AGE || age > MAX_AGE) return null
  if (!Number.isFinite(heightIn) || heightIn <= 0) return null
  if (!Number.isFinite(weightLbs) || weightLbs <= 0) return null

  const kg = weightLbs * KG_PER_LB
  const cm = heightIn * CM_PER_INCH
  const base = 10 * kg + 6.25 * cm - 5 * age
  const sexConstant = sex === "male" ? 5 : sex === "female" ? -161 : -78
  return base + sexConstant
}

/**
 * TDEE multiplier from weekly workout days (profile allows 2-6).
 * Unset falls back to 4 days, matching the dashboard's workout target.
 */
function activityFactor(workoutDays: number | null): number {
  const days = workoutDays ?? 4
  if (days <= 2) return 1.375
  if (days === 3) return 1.465
  if (days === 4) return 1.55
  if (days === 5) return 1.64
  return 1.725
}

const GOAL_CONFIG = {
  lose_weight: {
    calorieDelta: -500,
    proteinPerLb: 1.0,
    fatShare: 0.3,
    note: "a 500 cal/day deficit (~1 lb/week) for your weight-loss goal",
  },
  build_muscle: {
    calorieDelta: 300,
    proteinPerLb: 1.0,
    fatShare: 0.3,
    note: "a 300 cal/day lean surplus for muscle gain",
  },
  improve_endurance: {
    calorieDelta: 0,
    proteinPerLb: 0.7,
    fatShare: 0.25,
    note: "maintenance calories with a carb-forward split for endurance",
  },
  general_fitness: {
    calorieDelta: 0,
    proteinPerLb: 0.8,
    fatShare: 0.3,
    note: "maintenance calories for general fitness",
  },
} as const

/** Don't recommend cutting below commonly cited daily minimums. */
function calorieFloor(sex: MacroTargetInputs["sex"]): number {
  if (sex === "male") return 1500
  if (sex === "female") return 1200
  return 1350
}

const roundTo = (x: number, step: number) => Math.round(x / step) * step

/**
 * Daily calorie + macro targets for a profile, or null when the profile
 * is missing any of age, sex, height, or current weight.
 */
export function macroTargets(
  profile: MacroTargetInputs | null | undefined
): MacroTargets | null {
  if (!profile) return null
  const bmr = estimateBmr(profile)
  if (bmr == null) return null
  // estimateBmr returning non-null guarantees current_weight is set.
  const weightLbs = profile.current_weight as number

  const goal = GOAL_CONFIG[profile.primary_goal ?? "general_fitness"]
  const tdee = bmr * activityFactor(profile.workout_days)
  const calories = Math.max(tdee + goal.calorieDelta, calorieFloor(profile.sex))

  // On a cut, anchor protein to the weight you're heading toward (when
  // set) rather than the weight you're leaving behind.
  const proteinBasisLbs =
    profile.primary_goal === "lose_weight" && profile.target_weight != null
      ? profile.target_weight
      : weightLbs
  const proteinG = goal.proteinPerLb * proteinBasisLbs

  const fatG = Math.max((goal.fatShare * calories) / 9, 0.3 * weightLbs)
  const carbsG = Math.max(0, (calories - proteinG * 4 - fatG * 9) / 4)

  return {
    calories: roundTo(calories, 10),
    protein_g: roundTo(proteinG, 5),
    carbs_g: roundTo(carbsG, 5),
    fat_g: roundTo(fatG, 5),
    sugar_limit_g: roundTo((0.1 * calories) / 4, 5),
    goalNote: goal.note,
  }
}
