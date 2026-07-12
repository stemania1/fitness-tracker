/**
 * Helpers for displaying a prescribed rep target ("6-8", "20-30 sec",
 * "15-20 min") in the workout logger. Plan presets carry the unit inside
 * the string, so display logic needs to know whether the number the user
 * types is reps, seconds held, or minutes.
 */

/** True when the target is a timed hold (e.g. plank "20-30 sec"). */
export function isTimedTarget(repsTarget: string | null | undefined): boolean {
  return repsTarget != null && /\bsecs?\b/i.test(repsTarget)
}

/**
 * Human label for a target: bare rep ranges get the unit appended
 * ("6-8" → "6-8 reps"), targets that already carry one pass through.
 */
export function repsTargetLabel(repsTarget: string): string {
  return /^[\d\s–-]+$/.test(repsTarget.trim())
    ? `${repsTarget.trim()} reps`
    : repsTarget.trim()
}
