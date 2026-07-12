/**
 * Pure stats helpers for the Goals page — extracted from the page component so
 * they can be unit-tested. Weekly-streak count and weekly training volume, both
 * bucketed by a simple "W{n}" week label within a year.
 */

/** Coarse ISO-ish week label, e.g. "W28". Bucketing only — not calendar-exact. */
export function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 +
      startOfYear.getDay() +
      1) /
      7
  )
  return `W${weekNum}`
}

/**
 * Consecutive most-recent weeks that met the per-week workout target. Weeks are
 * keyed by year + week label; the streak counts back from the latest week and
 * stops at the first week below target.
 */
export function calcWeeklyStreak(
  workoutLogs: { started_at: string }[],
  targetPerWeek: number
): number {
  if (!workoutLogs.length || targetPerWeek <= 0) return 0

  const weekMap = new Map<string, number>()
  for (const log of workoutLogs) {
    const d = new Date(log.started_at)
    const yearWeek = `${d.getFullYear()}-${getWeekLabel(log.started_at)}`
    weekMap.set(yearWeek, (weekMap.get(yearWeek) ?? 0) + 1)
  }

  const sortedWeeks = [...weekMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  let streak = 0
  for (let i = sortedWeeks.length - 1; i >= 0; i--) {
    if (sortedWeeks[i][1] >= targetPerWeek) streak++
    else break
  }
  return streak
}

export interface VolumeWeek {
  week: string
  volume: number
}

/** Weekly strength volume (Σ weight × reps), last 12 weeks, ascending. */
export function calcVolumeByWeek(
  setLogData: {
    started_at: string
    exercise_logs: {
      set_logs: { weight: number | null; reps: number | null }[]
    }[]
  }[]
): VolumeWeek[] {
  const weekMap = new Map<string, number>()

  for (const workout of setLogData) {
    const week = getWeekLabel(workout.started_at)
    let vol = weekMap.get(week) ?? 0
    for (const ex of workout.exercise_logs) {
      for (const s of ex.set_logs) {
        if (s.weight && s.reps) vol += s.weight * s.reps
      }
    }
    weekMap.set(week, vol)
  }

  return [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, volume]) => ({ week, volume }))
}
