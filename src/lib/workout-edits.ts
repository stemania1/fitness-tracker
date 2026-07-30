/**
 * Pure edits to an in-progress workout.
 *
 * Every function takes the current workout and returns a new one, sharing
 * nothing mutable with the input — these were `setWorkout(prev => …)` closures
 * inside the logger, where an off-by-one silently corrupts a logged session
 * and nothing could assert the result without mounting the page.
 *
 * All of them no-op on an out-of-range index rather than spreading `undefined`
 * into the workout. The originals only guarded in a couple of places.
 */

import type { ExerciseDefinition } from "@/data/exercises"
import { makeSet, makeExercise, type ActiveSet, type ActiveWorkout } from "./active-workout"

function hasExercise(w: ActiveWorkout, exIdx: number): boolean {
  return exIdx >= 0 && exIdx < w.exercises.length
}

function hasSet(w: ActiveWorkout, exIdx: number, setIdx: number): boolean {
  return hasExercise(w, exIdx) && setIdx >= 0 && setIdx < w.exercises[exIdx].sets.length
}

/** Merge a patch into one set. */
export function updateSet(
  w: ActiveWorkout,
  exIdx: number,
  setIdx: number,
  patch: Partial<ActiveSet>
): ActiveWorkout {
  if (!hasSet(w, exIdx, setIdx)) return w
  const exercises = [...w.exercises]
  const ex = { ...exercises[exIdx] }
  const sets = [...ex.sets]
  sets[setIdx] = { ...sets[setIdx], ...patch }
  ex.sets = sets
  exercises[exIdx] = ex
  return { ...w, exercises }
}

/**
 * Flip one set's completed flag.
 *
 * Returns the rest interval to start alongside the new workout instead of
 * firing it as a side effect: the original called `setRestTimer` from inside
 * the `setWorkout` updater, which React may invoke more than once for a single
 * update (StrictMode double-invokes updaters in development), so the timer
 * could be armed spuriously. `restSeconds` is null when the set was being
 * UNchecked — un-completing a set must not start a rest timer.
 */
export function toggleSetComplete(
  w: ActiveWorkout,
  exIdx: number,
  setIdx: number
): { workout: ActiveWorkout; restSeconds: number | null } {
  if (!hasSet(w, exIdx, setIdx)) return { workout: w, restSeconds: null }
  const wasCompleted = w.exercises[exIdx].sets[setIdx].completed
  const workout = updateSet(w, exIdx, setIdx, { completed: !wasCompleted })
  return {
    workout,
    restSeconds: wasCompleted ? null : w.exercises[exIdx].restSeconds,
  }
}

/** Append a blank set to an exercise. */
export function addSet(w: ActiveWorkout, exIdx: number): ActiveWorkout {
  if (!hasExercise(w, exIdx)) return w
  const exercises = [...w.exercises]
  const ex = { ...exercises[exIdx] }
  ex.sets = [...ex.sets, makeSet()]
  exercises[exIdx] = ex
  return { ...w, exercises }
}

/** Drop a set, refusing to leave an exercise with none. */
export function removeSet(
  w: ActiveWorkout,
  exIdx: number,
  setIdx: number
): ActiveWorkout {
  if (!hasSet(w, exIdx, setIdx)) return w
  if (w.exercises[exIdx].sets.length <= 1) return w
  const exercises = [...w.exercises]
  const ex = { ...exercises[exIdx] }
  ex.sets = ex.sets.filter((_, i) => i !== setIdx)
  exercises[exIdx] = ex
  return { ...w, exercises }
}

export function updateExerciseNotes(
  w: ActiveWorkout,
  exIdx: number,
  notes: string
): ActiveWorkout {
  if (!hasExercise(w, exIdx)) return w
  const exercises = [...w.exercises]
  exercises[exIdx] = { ...exercises[exIdx], notes }
  return { ...w, exercises }
}

export function removeExercise(w: ActiveWorkout, exIdx: number): ActiveWorkout {
  if (!hasExercise(w, exIdx)) return w
  return { ...w, exercises: w.exercises.filter((_, i) => i !== exIdx) }
}

export function addExercise(
  w: ActiveWorkout,
  def: ExerciseDefinition
): ActiveWorkout {
  return { ...w, exercises: [...w.exercises, makeExercise(def)] }
}

/**
 * Replace one exercise with a substitute (e.g. a broken machine), keeping the
 * prescribed sets/reps/rest and any sets already entered.
 */
export function swapExercise(
  w: ActiveWorkout,
  exIdx: number,
  def: ExerciseDefinition
): ActiveWorkout {
  if (!hasExercise(w, exIdx)) return w
  const exercises = [...w.exercises]
  const old = exercises[exIdx]
  exercises[exIdx] = {
    ...old,
    exerciseId: def.id,
    name: def.name,
    muscleGroups: def.muscleGroups,
    assisted: def.assisted ?? false,
    exerciseType: def.exerciseType,
    equipmentId: def.equipmentId,
  }
  return { ...w, exercises }
}

/**
 * Where the cursor should land after removing the exercise at `removedIdx`.
 * Clamps into the shortened list so the logger can't point past the end.
 */
export function clampIndexAfterRemoval(
  currentIdx: number,
  removedIdx: number,
  lengthBefore: number
): number {
  const lengthAfter = Math.max(0, lengthBefore - 1)
  if (lengthAfter === 0) return 0
  const shifted = removedIdx < currentIdx ? currentIdx - 1 : currentIdx
  return Math.max(0, Math.min(shifted, lengthAfter - 1))
}
