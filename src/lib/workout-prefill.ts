/**
 * Pre-filling set weights from the previous session — the decision and the
 * state transform, extracted pure from the log page. The adaptive-target
 * maths itself lives in lib/adaptive-target; this decides whether a prefill
 * applies at all and what it writes.
 */

import { adaptiveTarget } from "./adaptive-target"
import { suggestedIncrement } from "./progressive-overload"
import type { ActiveExercise, ActiveWorkout } from "./active-workout"

/**
 * The weight to pre-fill into an exercise's sets, or null when no prefill
 * applies: cardio exercises, no previous session, sets the user has already
 * touched (a typed weight or rep, or a completed set), or no target weight.
 *
 * Reps are never pre-filled — they vary more than weight session to session.
 */
export function prefillWeight(
  exercise: ActiveExercise,
  previousSets: { weight: number | null; reps: number | null }[]
): number | null {
  if (exercise.exerciseType !== "strength") return null
  if (previousSets.length === 0) return null

  const untouched = exercise.sets.every(
    (s) => s.weight == null && s.reps == null && !s.completed
  )
  if (!untouched) return null

  // Pre-fill the adaptive target weight (progress / repeat / hold from last
  // session) rather than mirroring each set's raw previous weight, so the
  // prescribed session moves with recorded performance.
  const target = adaptiveTarget({
    previousSets: previousSets.map((s) => ({ weight: s.weight, reps: s.reps })),
    repRange: exercise.repsTarget,
    increment: suggestedIncrement(exercise.muscleGroups ?? []),
    assisted: exercise.assisted,
  })
  return target.weight ?? null
}

/** Write `weight` into every set of the exercise, leaving reps alone. */
export function applyPrefill(
  workout: ActiveWorkout,
  exerciseId: string,
  weight: number
): ActiveWorkout {
  const idx = workout.exercises.findIndex((e) => e.exerciseId === exerciseId)
  if (idx === -1) return workout
  const exercises = [...workout.exercises]
  const ex = { ...exercises[idx] }
  ex.sets = ex.sets.map((s) => ({ ...s, weight }))
  exercises[idx] = ex
  return { ...workout, exercises }
}
