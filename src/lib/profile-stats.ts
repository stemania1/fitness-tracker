/**
 * Pure stats for the profile page's headline numbers.
 *
 * Extracted from the `profile-stats` query, which mixed Supabase IO with the
 * streak and volume maths so neither could be tested.
 */

/** Local Monday 00:00 of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * The Monday before `weekStart`.
 *
 * Steps by CALENDAR days, not by 7×24h of milliseconds. Subtracting a fixed
 * 604800000ms crosses a daylight-saving boundary an hour off — stepping back
 * from Mon 9 Mar 2026 in US Eastern lands on Sun 8 Mar 23:00, not Mon 2 Mar
 * 00:00 — so the week never matches a bucketed workout week and the streak
 * silently truncates twice a year.
 */
function previousWeek(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() - 7)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Consecutive most-recent weeks containing at least one workout.
 *
 * Counts from the current week, or from last week when this week has no
 * workout yet — so the streak doesn't read as broken on a Monday morning
 * before you've trained.
 */
export function currentWeekStreak(
  workoutDates: { started_at: string }[],
  now: Date = new Date()
): number {
  if (!workoutDates.length) return 0

  const weeks = new Set(
    workoutDates.map((w) => startOfWeek(new Date(w.started_at)).getTime())
  )

  let cursor = startOfWeek(now)
  if (!weeks.has(cursor.getTime())) cursor = previousWeek(cursor)

  let streak = 0
  while (weeks.has(cursor.getTime())) {
    streak++
    cursor = previousWeek(cursor)
  }
  return streak
}

export interface VolumeSet {
  weight: number | null
  reps: number | null
}

/**
 * Total weight moved: weight × reps summed across every set.
 *
 * A set with weight but no recorded reps counts once rather than being
 * discarded, matching how the logger treats a bodyweight-style entry.
 */
export function totalWeightLifted(sets: VolumeSet[]): number {
  return sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 1), 0)
}
