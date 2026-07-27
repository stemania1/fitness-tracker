/**
 * Sleep-anchored bedtime target. When wake time is fixed (an early commute,
 * say), sleep is won at night — there's no sleeping in to catch up. Given a
 * wake time and a sleep goal, work backward to a target bedtime, a wind-down
 * time, and a last-safe-caffeine cutoff. Pure and clock-only (no dates), so
 * it's easy to unit-test and timezone-agnostic — the caller supplies the
 * user's local wake time as-is.
 */

export const DEFAULT_SLEEP_GOAL_HOURS = 7.5
/** Minutes before bed to start winding down (screens off, lights low). */
const WIND_DOWN_MINUTES = 30
/**
 * Hours before bedtime that caffeine should stop. 8h is roughly 1.4 caffeine
 * half-lives (elimination half-life ~5.5h) — not fully cleared, but the
 * commonly cited cutoff for it to stop meaningfully disrupting sleep.
 */
const CAFFEINE_CUTOFF_HOURS_BEFORE_BED = 8

export interface ClockTime {
  hour: number
  minute: number
}

export interface BedtimePlan {
  wakeTime: ClockTime
  bedtime: ClockTime
  windDownTime: ClockTime
  caffeineCutoff: ClockTime
  sleepGoalHours: number
}

/** Parse "HH:MM" (24h) into a ClockTime, or null if malformed. */
export function parseClockTime(hhmm: string): ClockTime | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

/** Format a ClockTime as "H:MM AM/PM". */
export function formatClockTime(t: ClockTime): string {
  const period = t.hour < 12 ? "AM" : "PM"
  const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12
  return `${h12}:${t.minute.toString().padStart(2, "0")} ${period}`
}

/** Subtract minutes from a ClockTime, wrapping around midnight (in either
 *  direction — negative input adds time). */
export function subtractMinutes(t: ClockTime, minutes: number): ClockTime {
  const totalMinutes = t.hour * 60 + t.minute
  const DAY = 24 * 60
  const shifted = ((totalMinutes - minutes) % DAY + DAY) % DAY
  return { hour: Math.floor(shifted / 60), minute: shifted % 60 }
}

/**
 * Build the full bedtime plan from a wake time and sleep goal: bedtime (wake
 * minus the goal), a wind-down time before that, and a caffeine cutoff before
 * that. Returns null for an unparseable wake time.
 */
export function buildBedtimePlan(
  wakeTimeStr: string,
  sleepGoalHours: number = DEFAULT_SLEEP_GOAL_HOURS
): BedtimePlan | null {
  const wakeTime = parseClockTime(wakeTimeStr)
  if (wakeTime == null) return null
  const goal = sleepGoalHours > 0 ? sleepGoalHours : DEFAULT_SLEEP_GOAL_HOURS

  const bedtime = subtractMinutes(wakeTime, Math.round(goal * 60))
  // Both wind-down and the caffeine cutoff fall earlier than bedtime.
  const windDownTime = subtractMinutes(bedtime, WIND_DOWN_MINUTES)
  const caffeineCutoff = subtractMinutes(
    bedtime,
    CAFFEINE_CUTOFF_HOURS_BEFORE_BED * 60
  )

  return { wakeTime, bedtime, windDownTime, caffeineCutoff, sleepGoalHours: goal }
}
