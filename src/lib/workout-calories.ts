/**
 * Calorie estimate for one exercise in an active workout, and for the workout
 * as a whole.
 *
 * `lib/calories.ts` owns the MET maths; this owns the step before it —
 * reducing a set list down to the totals and averages that maths wants, which
 * differs by exercise type and, for cardio, by whether the machine records
 * distance.
 */

import {
  estimateStrengthCalories,
  estimateCardioCalories,
  type CalorieProfile,
} from "./calories"
import {
  isDistanceCardio,
  computeSpeedMph,
  type ActiveExercise,
  type ActiveWorkout,
} from "./active-workout"

/** Mean of the positive, present values; null when there are none. */
function meanOfPositive(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => v != null && v > 0)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

/**
 * Calories for one exercise, counting only sets checked off as completed —
 * a set typed in but never completed hasn't been done yet.
 */
export function exerciseCalories(
  ex: ActiveExercise,
  userWeightLbs: number,
  profile: CalorieProfile
): number {
  const completed = ex.sets.filter((s) => s.completed)

  if (ex.exerciseType === "cardio") {
    const totalMins = completed.reduce((sum, s) => sum + (s.durationMins ?? 0), 0)
    // Treadmill and outdoor runs record distance, so speed is derived; other
    // cardio has the user enter speed directly.
    const avgSpeed = meanOfPositive(
      completed.map((s) =>
        isDistanceCardio(ex)
          ? computeSpeedMph(s.distanceMiles, s.durationMins)
          : s.speedMph
      )
    )
    // Treadmill only. Zero and missing entries are both skipped rather than
    // averaged in, so sets logged without an incline don't drag it toward 0.
    const avgIncline = meanOfPositive(completed.map((s) => s.inclinePercent))
    return estimateCardioCalories(
      ex.exerciseId,
      totalMins,
      userWeightLbs,
      avgSpeed,
      avgIncline,
      profile
    )
  }

  return estimateStrengthCalories(
    ex.exerciseId,
    completed.length,
    userWeightLbs,
    profile
  )
}

/** Calories across every exercise; 0 for a workout that hasn't loaded yet. */
export function workoutCalories(
  workout: ActiveWorkout | null,
  userWeightLbs: number,
  profile: CalorieProfile
): number {
  if (!workout) return 0
  return workout.exercises.reduce(
    (sum, ex) => sum + exerciseCalories(ex, userWeightLbs, profile),
    0
  )
}
