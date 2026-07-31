/**
 * Live progress for strength and endurance goals, computed from logged
 * workouts instead of a stale stored `current_value`. Strength progress is
 * measured by estimated 1-rep max (Epley) — so heavier weight AND more reps
 * both move it, and a target is a strength number rather than a single
 * heaviest lift. Endurance = longest single session (total minutes). Pure so
 * it's unit-tested; the Goals page resolves logged exercises to their static
 * catalog id and feeds them in.
 */

import { estimateOneRepMax } from "./personal-records"

export interface SetInput {
  weight: number | null
  reps: number | null
}

export interface LoggedExerciseRow {
  /** Static catalog id (resolved from the logged exercise name); null if it
   *  doesn't map to a known catalog entry. */
  staticExerciseId: string | null
  /** Sets logged for this exercise in one session (weight + reps). */
  sets: SetInput[]
  /** Total logged minutes for this exercise in one session. */
  sessionMinutes: number
  /** Total logged distance for this exercise in one session, in miles. */
  sessionDistanceMiles?: number
}

export interface ExerciseBest {
  /** Heaviest single weight ever logged. */
  bestWeight: number | null
  /** Best estimated 1-rep max (Epley) across all logged sets. */
  bestE1RM: number | null
  bestSessionMinutes: number | null
  /** Longest single session by distance, in miles. */
  bestSessionDistanceMiles: number | null
}

/**
 * Endurance goals come in two flavours, told apart by the goal's stored unit:
 * how LONG you went, or how FAR. Existing goals were all minutes and carry
 * "mins", so anything that isn't a distance unit reads as duration.
 */
export const ENDURANCE_DISTANCE_UNIT = "mi"

export function isDistanceGoal(unit: string | null | undefined): boolean {
  return unit === ENDURANCE_DISTANCE_UNIT
}

export function computeExerciseBests(
  rows: LoggedExerciseRow[]
): Map<string, ExerciseBest> {
  const map = new Map<string, ExerciseBest>()
  for (const r of rows) {
    if (!r.staticExerciseId) continue
    const cur = map.get(r.staticExerciseId) ?? {
      bestWeight: null,
      bestE1RM: null,
      bestSessionMinutes: null,
      bestSessionDistanceMiles: null,
    }
    for (const s of r.sets) {
      if (s.weight == null || s.weight <= 0) continue
      cur.bestWeight = Math.max(cur.bestWeight ?? 0, s.weight)
      // e1RM needs reps; a weight logged without reps still counts toward
      // bestWeight, and liveGoalCurrent falls back to it when no set has reps.
      const e = estimateOneRepMax(s.weight, s.reps)
      if (e != null) cur.bestE1RM = Math.max(cur.bestE1RM ?? 0, e)
    }
    if (r.sessionMinutes > 0) {
      cur.bestSessionMinutes = Math.max(
        cur.bestSessionMinutes ?? 0,
        r.sessionMinutes
      )
    }
    if ((r.sessionDistanceMiles ?? 0) > 0) {
      cur.bestSessionDistanceMiles = Math.max(
        cur.bestSessionDistanceMiles ?? 0,
        r.sessionDistanceMiles!
      )
    }
    map.set(r.staticExerciseId, cur)
  }
  return map
}

export interface GoalLike {
  goal_type: "weight" | "strength" | "endurance" | "consistency"
  exercise_id: string | null
  current_value: number | null
  /** Distinguishes a distance endurance goal from a duration one. */
  unit?: string | null
}

/**
 * The value to show as "current" for a goal: derived from logs for
 * strength/endurance goals tied to an exercise, otherwise the stored
 * current_value. Strength uses estimated 1-rep max (falling back to the
 * heaviest logged weight when reps were never recorded).
 */
export function liveGoalCurrent(
  goal: GoalLike,
  bests: Map<string, ExerciseBest>
): number {
  if (
    (goal.goal_type === "strength" || goal.goal_type === "endurance") &&
    goal.exercise_id
  ) {
    const b = bests.get(goal.exercise_id)
    if (goal.goal_type === "strength") {
      return Math.round(b?.bestE1RM ?? b?.bestWeight ?? 0)
    }
    if (isDistanceGoal(goal.unit)) {
      return b?.bestSessionDistanceMiles ?? 0
    }
    return b?.bestSessionMinutes ?? 0
  }
  return goal.current_value ?? 0
}

/** Clamped 0–100 percent toward the target. */
export function goalProgressPercent(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)))
}
