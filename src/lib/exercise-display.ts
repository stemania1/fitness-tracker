/**
 * How the logger renders one exercise's set table — every mode flag the log
 * page derives per exercise, in one tested place. The individual predicates
 * live in active-workout / reps-target / load-type; this composes them and
 * owns the two rules that only existed inline: the hold-timer target parse
 * and the shared grid template.
 */

import {
  isTreadmill,
  isOutdoorRun,
  isDistanceCardio,
  type ActiveExercise,
} from "./active-workout"
import { isTimedTarget } from "./reps-target"
import { isBodyweightLoad } from "./load-type"

export interface ExerciseDisplay {
  isCardio: boolean
  /** Timed hold (e.g. plank "20-30 sec"): the reps column records seconds
   *  held, so headers and placeholders must say so. */
  isTimedHold: boolean
  /** No loadable equipment — the weight cell shows "Bodyweight", not an
   *  lbs input. */
  isBodyweight: boolean
  /** Target seconds for the hold timer, parsed from e.g. "20-30 sec"
   *  (the upper bound); null when not a timed hold or unparseable. */
  holdTargetSeconds: number | null
  isTreadmill: boolean
  isOutdoorRun: boolean
  isDistanceCardio: boolean
  /** The header row and every set row must share a column template or they
   *  drift out of alignment. */
  setGridCols: string
}

export function exerciseDisplay(
  exercise: ActiveExercise | undefined
): ExerciseDisplay {
  const isCardio = exercise?.exerciseType === "cardio"
  const isTimedHold = !isCardio && isTimedTarget(exercise?.repsTarget)
  const isBodyweight =
    !!exercise &&
    isBodyweightLoad({
      equipmentId: exercise.equipmentId,
      assisted: exercise.assisted,
      exerciseType: exercise.exerciseType,
    })
  const holdTargetSeconds = isTimedHold
    ? Number(exercise?.repsTarget?.match(/(\d+)/g)?.slice(-1)[0]) || null
    : null
  const distanceCardio = !!exercise && isDistanceCardio(exercise)
  const setGridCols = distanceCardio
    ? "grid-cols-[2.5rem_1fr_1fr_3.5rem_3rem]"
    : isCardio
      ? "grid-cols-[2.5rem_1fr_1fr_1fr_3rem]"
      : "grid-cols-[2.5rem_1fr_1fr_3rem]"

  return {
    isCardio,
    isTimedHold,
    isBodyweight,
    holdTargetSeconds,
    isTreadmill: !!exercise && isTreadmill(exercise),
    isOutdoorRun: !!exercise && isOutdoorRun(exercise),
    isDistanceCardio: distanceCardio,
    setGridCols,
  }
}
