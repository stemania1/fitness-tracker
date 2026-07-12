/**
 * Time series for a strength/endurance goal's exercise, for the progress
 * chart: one point per day, value = that day's top-set weight (strength) or
 * longest session in minutes (endurance). Pure so it's unit-tested; the Goals
 * page supplies dated logged rows already resolved to static catalog ids.
 */

export interface DatedExerciseRow {
  staticExerciseId: string | null
  /** ISO timestamp of the session. */
  date: string
  weights: number[]
  sessionMinutes: number
}

export interface TrendPoint {
  /** YYYY-MM-DD. */
  date: string
  value: number
}

export function buildGoalTrend(
  rows: DatedExerciseRow[],
  staticExerciseId: string,
  goalType: "strength" | "endurance"
): TrendPoint[] {
  const byDay = new Map<string, number>()

  for (const r of rows) {
    if (r.staticExerciseId !== staticExerciseId) continue
    const day = r.date.slice(0, 10)
    const value =
      goalType === "strength"
        ? r.weights.reduce((m, w) => (w > m ? w : m), 0)
        : r.sessionMinutes
    if (value <= 0) continue
    // Multiple entries the same day → keep the best.
    byDay.set(day, Math.max(byDay.get(day) ?? 0, value))
  }

  return [...byDay.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
