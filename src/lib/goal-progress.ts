/**
 * Live progress for strength and endurance goals, computed from logged
 * workouts instead of a stale stored `current_value`. Strength = heaviest
 * weight ever lifted for the goal's exercise; endurance = longest single
 * session (total minutes) for it. Pure so it's unit-tested; the Goals page
 * resolves logged exercises to their static catalog id and feeds them in.
 */

export interface LoggedExerciseRow {
  /** Static catalog id (resolved from the logged exercise name); null if it
   *  doesn't map to a known catalog entry. */
  staticExerciseId: string | null
  /** Non-null set weights logged for this exercise in one session. */
  weights: number[]
  /** Total logged minutes for this exercise in one session. */
  sessionMinutes: number
}

export interface ExerciseBest {
  bestWeight: number | null
  bestSessionMinutes: number | null
}

export function computeExerciseBests(
  rows: LoggedExerciseRow[]
): Map<string, ExerciseBest> {
  const map = new Map<string, ExerciseBest>()
  for (const r of rows) {
    if (!r.staticExerciseId) continue
    const cur = map.get(r.staticExerciseId) ?? {
      bestWeight: null,
      bestSessionMinutes: null,
    }
    for (const w of r.weights) {
      if (w > 0) cur.bestWeight = Math.max(cur.bestWeight ?? 0, w)
    }
    if (r.sessionMinutes > 0) {
      cur.bestSessionMinutes = Math.max(
        cur.bestSessionMinutes ?? 0,
        r.sessionMinutes
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
}

/**
 * The value to show as "current" for a goal: derived from logs for
 * strength/endurance goals tied to an exercise, otherwise the stored
 * current_value.
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
    if (goal.goal_type === "strength") return b?.bestWeight ?? 0
    return b?.bestSessionMinutes ?? 0
  }
  return goal.current_value ?? 0
}

/** Clamped 0–100 percent toward the target. */
export function goalProgressPercent(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)))
}
