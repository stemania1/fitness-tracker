/**
 * Caffeine's two effects on how you feel, kept separate on purpose:
 *
 *  1. **Now** — an alertness bump while caffeine is on board, and a mild dip
 *     as a meaningful dose wears off (the "crash"). This feeds the expected
 *     energy read.
 *  2. **Tonight** — caffeine taken too late cuts into deep sleep even when you
 *     fall asleep fine. That's a forward-looking sleep warning, NOT part of
 *     today's energy; it's surfaced on its own so the "late coffee → poor
 *     sleep → tired tomorrow" loop is visible.
 *
 * Caffeine masks fatigue rather than adding real energy, so the "now" effect
 * is deliberately small — it nudges the read, it doesn't dominate it.
 *
 * Guidance, not diagnosis. Sensitivities vary a lot between people.
 */

import { formatClockTimeShort, type ClockTime } from "./bedtime"

/** Elimination half-life of caffeine in a typical adult (~5.5h). */
export const CAFFEINE_HALF_LIFE_MIN = 330

/**
 * Commonly cited daily ceiling for healthy adults (FDA). A reference for the
 * daily tracker, not a hard limit or medical advice.
 */
export const DAILY_CAFFEINE_GUIDELINE_MG = 400

/** One logged caffeine intake, relative to "now". */
export interface CaffeineDose {
  /** Milligrams of caffeine. */
  mg: number
  /** Minutes before now it was consumed (>= 0; future doses are ignored). */
  minutesAgo: number
  /** Local hour it was consumed, 0-23 (for the late-caffeine sleep check). */
  hour: number
  /**
   * Minute within `hour`. Optional, reading as :00 when absent — it only
   * matters against a cutoff that isn't on the hour, which a bedtime-derived
   * one usually isn't (a 6:30am wake time puts it at 2:30pm).
   */
  minute?: number
}

/**
 * Common drinks → typical caffeine content (mg), for quick logging.
 *
 * Ordered by how often it is actually tapped, not by size. The thermos is two
 * cups and gets poured every morning, so it leads and supplies the dialog's
 * default; a list sorted by anything else puts the daily action behind the
 * occasional ones.
 */
export const CAFFEINE_PRESETS: Array<{ label: string; mg: number }> = [
  { label: "Thermos", mg: 190 },
  { label: "Coffee", mg: 95 },
  { label: "Espresso", mg: 65 },
  { label: "Cold brew", mg: 155 },
  { label: "Black tea", mg: 47 },
  { label: "Green tea", mg: 28 },
  { label: "Energy drink", mg: 80 },
  { label: "Soda", mg: 40 },
]

export type CaffeineLevel = "none" | "active" | "fading"

export interface CaffeineStatus {
  level: CaffeineLevel
  /** Estimated caffeine still active right now (mg), decayed by half-life. */
  onBoardMg: number
  /** Total consumed today (mg). */
  totalTodayMg: number
}

/** Caffeine still active now, summing each dose's exponential decay. */
export function caffeineOnBoardMg(doses: CaffeineDose[]): number {
  return doses.reduce((sum, d) => {
    if (d.minutesAgo < 0) return sum
    return sum + d.mg * Math.pow(0.5, d.minutesAgo / CAFFEINE_HALF_LIFE_MIN)
  }, 0)
}

/**
 * Classify the current caffeine state:
 *  - `active`  — enough on board to feel alert (>= 50mg);
 *  - `fading`  — a real dose was taken but has mostly cleared (the crash window);
 *  - `none`    — negligible caffeine today.
 */
export function caffeineStatus(doses: CaffeineDose[]): CaffeineStatus {
  const onBoard = caffeineOnBoardMg(doses)
  const totalToday = doses.reduce((s, d) => s + (d.minutesAgo >= 0 ? d.mg : 0), 0)
  const onBoardMg = Math.round(onBoard)
  const totalTodayMg = Math.round(totalToday)

  let level: CaffeineLevel = "none"
  if (onBoard >= 50) level = "active"
  else if (totalToday >= 80 && onBoard >= 10) level = "fading"

  return { level, onBoardMg, totalTodayMg }
}

export interface LateCaffeineFlag {
  late: boolean
  /** Local hour of the latest late dose, or null. */
  latestHour: number | null
  message: string
}

/** Format a 0-23 hour as a friendly clock time, e.g. 14 → "2pm". */
export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24
  const period = h < 12 ? "am" : "pm"
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}${period}`
}

/**
 * Fallback cutoff when there's no wake time on file to anchor one: 2pm,
 * roughly 8h before a typical 10pm bedtime.
 */
export const DEFAULT_CAFFEINE_CUTOFF: ClockTime = { hour: 14, minute: 0 }

/**
 * Flag caffeine taken late enough to risk tonight's sleep.
 *
 * `cutoff` should be the user's own, from `buildBedtimePlan` — it works back
 * from their wake time and sleep goal, so someone up at 5am gets an earlier
 * cutoff than someone up at 8am. The 2pm default only applies when no wake
 * time is set: a generic cutoff is wrong for most schedules in one direction
 * or the other, and telling an early riser that 2pm is fine is the kind of
 * advice that quietly costs them sleep.
 */
export function lateCaffeineFlag(
  doses: CaffeineDose[],
  cutoff: ClockTime = DEFAULT_CAFFEINE_CUTOFF
): LateCaffeineFlag {
  const cutoffMinutes = cutoff.hour * 60 + cutoff.minute
  const late = doses
    .filter((d) => d.minutesAgo >= 0 && minutesIntoDay(d) >= cutoffMinutes)
    .sort((a, b) => minutesIntoDay(b) - minutesIntoDay(a))

  if (late.length === 0) {
    return { late: false, latestHour: null, message: "" }
  }

  const latest = late[0]
  const latestTime: ClockTime = {
    hour: latest.hour,
    minute: latest.minute ?? 0,
  }
  return {
    late: true,
    latestHour: latest.hour,
    message: `Caffeine after ${formatClockTimeShort(cutoff)} can cut into tonight's deep sleep — your latest was around ${formatClockTimeShort(latestTime)}. An earlier cutoff tomorrow tends to lift next-day energy.`,
  }
}

/** A dose's clock time as minutes past midnight. */
function minutesIntoDay(d: CaffeineDose): number {
  return d.hour * 60 + (d.minute ?? 0)
}
