/**
 * Calorie calculation using MET (Metabolic Equivalent of Task) values.
 *
 * Formula: Calories = MET × body weight (kg) × duration (hours)
 * Body weight is stored in lbs internally, so we convert: kg = lbs × 0.453592
 *
 * The base formula assumes 1 MET = 1 kcal/kg/hr, which is calibrated to a
 * reference adult. Actual resting metabolism declines with age and varies
 * by sex and size, so when the profile is available we scale by a
 * Mifflin-St Jeor RMR correction (see rmrCorrectionFactor).
 */

/** Optional user context that refines calorie estimates. */
export interface CalorieProfile {
  age?: number | null
  sex?: "male" | "female" | "other" | null
  heightInches?: number | null
}

/**
 * Ratio of the user's estimated resting metabolic rate (Mifflin-St Jeor)
 * to the 1 kcal/kg/hr the MET convention assumes. For a 51-year-old this
 * is typically ~0.85-0.95, i.e. the generic formula overestimates burn.
 *
 * Returns 1 (no correction) when age or height is missing/implausible.
 * Clamped to [0.75, 1.25] so bad profile data can't skew estimates wildly.
 */
export function rmrCorrectionFactor(
  bodyWeightLbs: number,
  profile?: CalorieProfile
): number {
  const age = profile?.age
  const heightInches = profile?.heightInches
  if (age == null || !Number.isFinite(age) || age < 13 || age > 100) return 1
  if (heightInches == null || !Number.isFinite(heightInches) || heightInches <= 0) return 1
  const weightKg = bodyWeightLbs * 0.453592
  if (!(weightKg > 0)) return 1

  const heightCm = heightInches * 2.54
  // Mifflin-St Jeor: sex term is +5 (male) / -161 (female); midpoint for
  // other/unknown.
  const sexTerm =
    profile?.sex === "male" ? 5 : profile?.sex === "female" ? -161 : -78
  const rmrKcalPerDay = 10 * weightKg + 6.25 * heightCm - 5 * age + sexTerm
  const factor = rmrKcalPerDay / (weightKg * 24)
  return Math.min(1.25, Math.max(0.75, factor))
}

/** MET values for exercises by exercise ID or category */
const MET_VALUES: Record<string, number> = {
  // Cardio
  "treadmill-walk": 3.5,
  "treadmill-jog": 7.0,
  "incline-treadmill-walk": 5.5,
  "treadmill-run": 9.8,
  "elliptical-exercise": 5.0,
  "stairmaster-exercise": 9.0,
  "stationary-bike-exercise": 6.8,
  "rowing-exercise": 7.0,
  "outdoor-run": 9.8,

  // Bodyweight / Calisthenics
  "push-ups": 3.8,
  "plank": 3.0,
  "mountain-climbers": 8.0,
  "bicycle-crunches": 3.5,
  "dead-bug": 3.0,

  // Stretches / Mobility (the logger estimates all non-cardio via the
  // strength path, so these need explicit entries to avoid the 3.5
  // strength default)
  "standing-calf-stretch": 2.3,
  "bent-knee-calf-stretch": 2.3,
  "heel-drop-stretch": 2.3,
  "foam-roll-calves": 2.5,
}

/** Default MET by exercise type for exercises not in the map */
const DEFAULT_MET: Record<string, number> = {
  strength: 3.5,
  cardio: 6.0,
  flexibility: 2.5,
}

function getMetValue(exerciseId: string, exerciseType: string): number {
  return MET_VALUES[exerciseId] ?? DEFAULT_MET[exerciseType] ?? 3.5
}

/**
 * Estimate calories burned for a strength exercise.
 *
 * Uses a time-per-set estimate: ~2 minutes per set (including rest).
 * This is a rough average: ~45s under tension + ~75s rest.
 */
export function estimateStrengthCalories(
  exerciseId: string,
  completedSets: number,
  bodyWeightLbs: number,
  profile?: CalorieProfile
): number {
  const met = getMetValue(exerciseId, "strength")
  const weightKg = bodyWeightLbs * 0.453592
  const minutesPerSet = 2
  const durationHours = (completedSets * minutesPerSet) / 60
  const correction = rmrCorrectionFactor(bodyWeightLbs, profile)
  return Math.round(met * weightKg * durationHours * correction)
}

/**
 * Estimate calories burned for a cardio exercise.
 *
 * Uses actual duration logged by the user.
 */
export function estimateCardioCalories(
  exerciseId: string,
  durationMins: number,
  bodyWeightLbs: number,
  speedMph?: number | null,
  inclinePercent?: number | null,
  profile?: CalorieProfile
): number {
  let met = getMetValue(exerciseId, "cardio")

  // Adjust MET based on speed for treadmill exercises
  if (speedMph && speedMph > 0) {
    if (exerciseId.includes("treadmill")) {
      if (speedMph < 3.0) met = 2.5
      else if (speedMph < 4.0) met = 3.5
      else if (speedMph < 5.0) met = 5.5
      else if (speedMph < 6.0) met = 7.0
      else if (speedMph < 7.5) met = 9.8
      else if (speedMph < 9.0) met = 11.0
      else met = 12.8
    }
  }

  // Incline bump: only at walking pace (< 4 mph) where it actually changes
  // demand much. +0.5 MET per 1% grade. Cap at +10 MET so a 30% incline
  // typo doesn't blow up the estimate.
  if (
    inclinePercent != null &&
    inclinePercent > 0 &&
    speedMph != null &&
    speedMph > 0 &&
    speedMph < 4.0
  ) {
    met += Math.min(10, inclinePercent * 0.5)
  }

  const weightKg = bodyWeightLbs * 0.453592
  const durationHours = durationMins / 60
  const correction = rmrCorrectionFactor(bodyWeightLbs, profile)
  return Math.round(met * weightKg * durationHours * correction)
}

/**
 * Calculate total estimated calories for a workout.
 *
 * @param exercises - Array of exercises with their logged data
 * @param bodyWeightLbs - User's body weight in pounds
 */
export interface ExerciseCalorieInput {
  exerciseId: string
  exerciseType: "strength" | "cardio" | "flexibility"
  completedSets: number
  totalDurationMins: number | null
  speedMph?: number | null
  inclinePercent?: number | null
}

export function calculateWorkoutCalories(
  exercises: ExerciseCalorieInput[],
  bodyWeightLbs: number,
  profile?: CalorieProfile
): { perExercise: number[]; total: number } {
  const perExercise = exercises.map((ex) => {
    if (ex.exerciseType === "cardio" && ex.totalDurationMins) {
      return estimateCardioCalories(
        ex.exerciseId,
        ex.totalDurationMins,
        bodyWeightLbs,
        ex.speedMph,
        ex.inclinePercent,
        profile
      )
    }
    return estimateStrengthCalories(
      ex.exerciseId,
      ex.completedSets,
      bodyWeightLbs,
      profile
    )
  })

  return {
    perExercise,
    total: perExercise.reduce((sum, cal) => sum + cal, 0),
  }
}
