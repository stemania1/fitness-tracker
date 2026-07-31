/**
 * Time series for a strength/endurance goal's exercise, for the progress
 * chart: one point per day. Strength value = that day's best estimated 1-rep
 * max (Epley); endurance = longest session in minutes. Pure so it's
 * unit-tested; the Goals page supplies dated logged rows already resolved to
 * static catalog ids.
 */

import { estimateOneRepMax } from "./personal-records"
import type { SetInput } from "./goal-progress"
import { isDistanceGoal } from "./goal-progress"

export interface DatedExerciseRow {
  staticExerciseId: string | null
  /** ISO timestamp of the session. */
  date: string
  sets: SetInput[]
  sessionMinutes: number
  /** Total logged distance for the session, in miles. */
  sessionDistanceMiles?: number
}

export interface TrendPoint {
  /** YYYY-MM-DD. */
  date: string
  value: number
}

/** Best estimated 1-rep max across a session's sets (falls back to the
 *  heaviest weight when reps weren't logged); 0 when there's no valid set. */
function bestSessionE1RM(sets: SetInput[]): number {
  let best = 0
  for (const s of sets) {
    if (s.weight == null || s.weight <= 0) continue
    const e = estimateOneRepMax(s.weight, s.reps) ?? s.weight
    if (e > best) best = e
  }
  return best
}

export function buildGoalTrend(
  rows: DatedExerciseRow[],
  staticExerciseId: string,
  goalType: "strength" | "endurance",
  /** The goal's stored unit; "mi" plots distance rather than duration. */
  unit?: string | null
): TrendPoint[] {
  const byDay = new Map<string, number>()

  for (const r of rows) {
    if (r.staticExerciseId !== staticExerciseId) continue
    const day = r.date.slice(0, 10)
    const value =
      goalType === "strength"
        ? Math.round(bestSessionE1RM(r.sets))
        : isDistanceGoal(unit)
          ? (r.sessionDistanceMiles ?? 0)
          : r.sessionMinutes
    if (value <= 0) continue
    // Multiple entries the same day → keep the best.
    byDay.set(day, Math.max(byDay.get(day) ?? 0, value))
  }

  return [...byDay.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
