/**
 * Creatine daily-streak logic. Consistency is what makes creatine work, so the
 * card celebrates a run of consecutive days taken. Pure and date-string based
 * (YYYY-MM-DD local dates) so it's timezone-safe and unit-tested.
 */

import { shiftDateString } from "./dates"

/**
 * Current streak of consecutive days taken, ending at `today`. If today isn't
 * logged yet the streak counts back from yesterday, so an as-yet-unlogged day
 * doesn't read as a broken streak — taking it today extends the run.
 */
export function currentStreak(takenDates: Iterable<string>, today: string): number {
  const set = takenDates instanceof Set ? takenDates : new Set(takenDates)
  // Anchor at today if taken, else yesterday.
  let cursor = set.has(today) ? today : shiftDateString(today, -1)
  let streak = 0
  while (set.has(cursor)) {
    streak++
    cursor = shiftDateString(cursor, -1)
  }
  return streak
}

/** Default daily creatine target (g) — the classic maintenance dose. */
export const DEFAULT_CREATINE_TARGET_G = 5
/** Dose sizes offered on the card, in grams. */
export const CREATINE_DOSE_OPTIONS = [2.5, 5, 10]

export interface CreatineProgress {
  /** Grams logged today. */
  totalG: number
  targetG: number
  /** Whole percent of target, capped at 100. */
  pct: number
  /** Whether today's target has been reached. */
  met: boolean
  /** Grams still to go (0 once met). */
  remainingG: number
}

/**
 * Today's progress toward the creatine target. Doses accumulate across the day
 * (10 g is often split), so the card tracks a running total rather than a
 * single all-or-nothing dose.
 */
export function creatineProgress(
  totalG: number,
  targetG: number = DEFAULT_CREATINE_TARGET_G
): CreatineProgress {
  const total = Math.max(0, totalG)
  const target = targetG > 0 ? targetG : DEFAULT_CREATINE_TARGET_G
  const pct = Math.min(100, Math.round((total / target) * 100))
  const remaining = Math.max(0, Math.round((target - total) * 10) / 10)
  return {
    totalG: Math.round(total * 10) / 10,
    targetG: target,
    pct,
    met: total >= target,
    remainingG: remaining,
  }
}
