/**
 * How an exercise carries load — the thing that decides whether a weight
 * input, a "Bodyweight" label or a stopwatch belongs in the logger, and
 * whether progression means adding weight, dropping assistance, or adding
 * reps.
 *
 * This used to be inferred separately at each call site, always from
 * `equipmentId === null`, and the inference was wrong in both directions:
 *
 *   - Pull-Up was given a weight-based adaptive target ("stay at 230 lb before
 *     adding weight") on an exercise with no weight input to act on.
 *   - A Dumbbell Shrug farmer hold had its weight input replaced by a
 *     stopwatch, because "timed" was assumed to mean "bodyweight" — losing the
 *     load entirely, on an exercise whose whole point is heavy dumbbells.
 *
 * One derivation, one place to correct, and per-exercise overrides for the
 * cases equipment can't express.
 */

import type { ExerciseDefinition } from "@/data/exercises"

export type LoadType =
  /** External weight the user selects and progresses. */
  | "loaded"
  /** The user's own body — progression is reps, not load. */
  | "bodyweight"
  /** Machine counterweight: higher "weight" is easier, progress DROPS it. */
  | "assisted"

/** The subset of a catalog entry that determines load type. */
export type LoadTypeInput = Pick<
  ExerciseDefinition,
  "equipmentId" | "assisted" | "exerciseType"
> & { loadType?: LoadType }

/**
 * Resolve how an exercise is loaded.
 *
 * An explicit `loadType` on the catalog entry always wins — that is the escape
 * hatch for anything equipment alone can't express (a weighted pull-up carries
 * load despite the movement being bodyweight).
 */
export function resolveLoadType(def: LoadTypeInput): LoadType {
  if (def.loadType) return def.loadType
  if (def.assisted) return "assisted"
  if (def.exerciseType === "strength" && def.equipmentId === null) {
    return "bodyweight"
  }
  return "loaded"
}

/** True when there is no weight to enter — the logger shows "Bodyweight". */
export function isBodyweightLoad(def: LoadTypeInput): boolean {
  return resolveLoadType(def) === "bodyweight"
}

/** True when the logged "weight" is assistance rather than load. */
export function isAssistedLoad(def: LoadTypeInput): boolean {
  return resolveLoadType(def) === "assisted"
}
