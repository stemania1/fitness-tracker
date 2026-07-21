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

/** Elimination half-life of caffeine in a typical adult (~5.5h). */
export const CAFFEINE_HALF_LIFE_MIN = 330

/** One logged caffeine intake, relative to "now". */
export interface CaffeineDose {
  /** Milligrams of caffeine. */
  mg: number
  /** Minutes before now it was consumed (>= 0; future doses are ignored). */
  minutesAgo: number
  /** Local hour it was consumed, 0-23 (for the late-caffeine sleep check). */
  hour: number
}

/** Common drinks → typical caffeine content (mg), for quick logging. */
export const CAFFEINE_PRESETS: Array<{ label: string; mg: number }> = [
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
 * Flag caffeine taken late enough to risk tonight's sleep. Anything at or
 * after `cutoffHour` (default 2pm — roughly 8h before a typical bedtime, one
 * caffeine half-life plus change) is worth surfacing.
 */
export function lateCaffeineFlag(
  doses: CaffeineDose[],
  cutoffHour = 14
): LateCaffeineFlag {
  const late = doses
    .filter((d) => d.minutesAgo >= 0 && d.hour >= cutoffHour)
    .sort((a, b) => b.hour - a.hour)

  if (late.length === 0) {
    return { late: false, latestHour: null, message: "" }
  }

  const h = late[0].hour
  return {
    late: true,
    latestHour: h,
    message: `Caffeine after ${formatHour(cutoffHour)} can cut into tonight's deep sleep — your latest was around ${formatHour(h)}. An earlier cutoff tomorrow tends to lift next-day energy.`,
  }
}
