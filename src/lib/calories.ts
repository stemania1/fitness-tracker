/**
 * Calorie calculation using MET (Metabolic Equivalent of Task) values.
 *
 * Formula: Calories = MET × body weight (kg) × duration (hours)
 * Body weight is stored in lbs internally, so we convert: kg = lbs × 0.453592
 */

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
  bodyWeightLbs: number
): number {
  const met = getMetValue(exerciseId, "strength")
  const weightKg = bodyWeightLbs * 0.453592
  const minutesPerSet = 2
  const durationHours = (completedSets * minutesPerSet) / 60
  return Math.round(met * weightKg * durationHours)
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
  speedMph?: number | null
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

  const weightKg = bodyWeightLbs * 0.453592
  const durationHours = durationMins / 60
  return Math.round(met * weightKg * durationHours)
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
}

export function calculateWorkoutCalories(
  exercises: ExerciseCalorieInput[],
  bodyWeightLbs: number
): { perExercise: number[]; total: number } {
  const perExercise = exercises.map((ex) => {
    if (ex.exerciseType === "cardio" && ex.totalDurationMins) {
      return estimateCardioCalories(
        ex.exerciseId,
        ex.totalDurationMins,
        bodyWeightLbs,
        ex.speedMph
      )
    }
    return estimateStrengthCalories(
      ex.exerciseId,
      ex.completedSets,
      bodyWeightLbs
    )
  })

  return {
    perExercise,
    total: perExercise.reduce((sum, cal) => sum + cal, 0),
  }
}
