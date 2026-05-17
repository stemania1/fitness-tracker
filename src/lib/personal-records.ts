/**
 * Personal records and 1RM estimates.
 *
 * 1RM uses the Epley formula: weight × (1 + reps/30). It tracks well with
 * actual 1RM up to ~10-12 reps; beyond that it overestimates noticeably,
 * but for our purposes (relative progress over time) that's fine.
 */

/** Estimate one-rep max from a working set. Returns null for invalid input. */
export function estimateOneRepMax(
  weight: number | null,
  reps: number | null
): number | null {
  if (weight == null || reps == null) return null
  if (weight <= 0 || reps <= 0) return null
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/** Round an e1RM to one decimal place for display. */
export function formatE1RM(value: number | null): string {
  if (value == null) return "—"
  return `${Math.round(value * 10) / 10} lbs`
}

export interface SetForPR {
  weight: number | null
  reps: number | null
}

/**
 * Find the heaviest weight (at any rep count ≥ 1) across the given sets.
 * Used to determine the all-time max for an exercise.
 */
export function findHeaviestWeight(sets: SetForPR[]): number | null {
  let max: number | null = null
  for (const s of sets) {
    if (s.weight == null || s.reps == null) continue
    if (s.weight <= 0 || s.reps < 1) continue
    if (max == null || s.weight > max) max = s.weight
  }
  return max
}

/**
 * Is `set` a new personal record compared to `previousMaxWeight`?
 * A PR requires beating the previous max strictly (equal weight doesn't
 * count, to avoid spamming notifications on routine working sets).
 */
export function isNewPersonalRecord(
  set: SetForPR,
  previousMaxWeight: number | null
): boolean {
  if (set.weight == null || set.reps == null) return false
  if (set.weight <= 0 || set.reps < 1) return false
  if (previousMaxWeight == null) return true
  return set.weight > previousMaxWeight
}
