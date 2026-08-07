/**
 * Shape joined workout rows for computeExerciseBests / buildGoalTrend.
 *
 * Strength/endurance goals store a *static catalog* exercise id, but logged
 * workouts reference DB exercise rows — so each logged exercise's name is
 * resolved back to its catalog id (case-insensitive) before the goal can be
 * matched. Extracted from the goals page's query so the mapping is testable.
 */

import type { DatedExerciseRow } from "./goal-trend"
import { exercises as staticExercises } from "@/data/exercises"

/** The joined shape the goals page selects from workout_logs. */
export interface JoinedWorkoutRow {
  started_at: string
  exercise_logs: Array<{
    /** Supabase types embedded to-one relations as object-or-array. */
    exercises: { name: string } | { name: string }[] | null
    set_logs: Array<{
      weight: number | null
      reps: number | null
      duration_mins: number | null
      distance_miles: number | null
    }>
  }>
}

export function toDatedExerciseRows(
  workouts: JoinedWorkoutRow[],
  catalog: { id: string; name: string }[] = staticExercises
): DatedExerciseRow[] {
  const byName = new Map(catalog.map((e) => [e.name.toLowerCase(), e.id]))

  const rows: DatedExerciseRow[] = []
  for (const wl of workouts) {
    for (const el of wl.exercise_logs ?? []) {
      const rel = Array.isArray(el.exercises) ? el.exercises[0] : el.exercises
      const name = rel?.name
      const staticExerciseId = name
        ? byName.get(name.toLowerCase()) ?? null
        : null
      const sets = el.set_logs ?? []
      rows.push({
        staticExerciseId,
        date: wl.started_at,
        sets: sets.map((s) => ({ weight: s.weight, reps: s.reps })),
        sessionMinutes: sets.reduce((sum, s) => sum + (s.duration_mins ?? 0), 0),
        sessionDistanceMiles: sets.reduce(
          (sum, s) => sum + (s.distance_miles ?? 0),
          0
        ),
      })
    }
  }
  return rows
}
