"use client"

/**
 * Pre-fill set weights from the previous session. Runs once per exercise per
 * session, only while every set is still untouched — the decision and the
 * transform live in lib/workout-prefill (pure + tested); this owns the
 * once-per-exercise bookkeeping.
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import { prefillWeight, applyPrefill } from "@/lib/workout-prefill"
import type { ActiveExercise, ActiveWorkout } from "@/lib/active-workout"

export function useAdaptivePrefill(
  currentExercise: ActiveExercise | undefined,
  currentHistory:
    | { previousSets: { weight: number | null; reps: number | null }[] }
    | null
    | undefined,
  setWorkout: Dispatch<SetStateAction<ActiveWorkout | null>>
) {
  /** Exercises we've already pre-filled this session, so we don't clobber
   *  user edits if they tab back to the exercise. */
  const prefilledExercises = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!currentExercise) return
    if (currentExercise.exerciseType !== "strength") return
    if (prefilledExercises.current.has(currentExercise.exerciseId)) return
    // History not loaded yet — leave the exercise unmarked so the prefill
    // retries when it arrives.
    if (!currentHistory) return

    const fillWeight = prefillWeight(currentExercise, currentHistory.previousSets)
    prefilledExercises.current.add(currentExercise.exerciseId)
    if (fillWeight == null) return

    const exerciseId = currentExercise.exerciseId
    setWorkout((prev) =>
      prev ? applyPrefill(prev, exerciseId, fillWeight) : prev
    )
  }, [currentExercise, currentHistory, setWorkout])
}
