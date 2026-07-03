/**
 * Progressive overload suggestions.
 *
 * Heuristic (per user decision): if all working sets last session hit the
 * top of the prescribed rep range at the same weight, suggest a small
 * weight increase for the next session.
 */

/** Parse the top of a rep range string like "8-12", "10", "12-15". Returns
 *  null for non-numeric formats like "30 sec" or "10 each". */
export function parseRepRangeTop(reps: string | null | undefined): number | null {
  if (!reps) return null
  const trimmed = reps.trim()
  // Skip ranges that include words (e.g. "10 each", "30 sec")
  if (/[a-zA-Z]/.test(trimmed)) return null
  const match = trimmed.match(/(\d+)(?:\s*[-–]\s*(\d+))?/)
  if (!match) return null
  const top = match[2] ?? match[1]
  const n = parseInt(top, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface PreviousSet {
  weight: number | null
  reps: number | null
}

const LOWER_BODY_GROUPS = new Set(["quads", "hamstrings", "glutes"])

/**
 * Size the weight increment to the exercise instead of a flat +5 lbs.
 * A +5 jump is trivial on a leg press but a ~30-50% leap on a lateral
 * raise; small-muscle isolation work needs smaller steps.
 *
 *  - Lower-body compound (multi-group with quads/hams/glutes): +10
 *  - Lower-body isolation (leg curl, leg extension):           +5
 *  - Upper-body compound (press, row):                         +5
 *  - Isolation / small-muscle (curls, raises, flys):           +2.5
 */
export function suggestedIncrement(muscleGroups: string[]): number {
  const groups = muscleGroups.filter((g) => g !== "full_body")
  if (groups.length === 0) return 5
  const hasLower = groups.some((g) => LOWER_BODY_GROUPS.has(g))
  const isCompound = groups.length >= 2
  if (hasLower) return isCompound ? 10 : 5
  return isCompound ? 5 : 2.5
}

export interface OverloadSuggestion {
  /** The weight you used last session (and should beat this time). */
  previousWeight: number
  /** Suggested next weight (current + increment). */
  suggestedWeight: number
  /** Increment applied. */
  increment: number
  /** Top of the prescribed rep range that was cleared on all sets. */
  repTarget: number
}

/**
 * Determine if last session cleared all working sets at the top of the
 * rep range with a consistent weight. If so, suggest the next weight.
 *
 * @param previousSets   Sets from the most recent logged session for this
 *                       exercise (any number of sets).
 * @param repRangeTop    Top of the prescribed rep range for the current
 *                       session (e.g. 12 from "8-12").
 * @param increment      Weight bump in lbs. Defaults to 5.
 */
export function getOverloadSuggestion(
  previousSets: PreviousSet[],
  repRangeTop: number | null,
  increment: number = 5
): OverloadSuggestion | null {
  if (repRangeTop == null) return null
  if (previousSets.length === 0) return null

  // Every set must be valid, hit the rep target, and share the same weight.
  let weight: number | null = null
  for (const s of previousSets) {
    if (s.weight == null || s.reps == null) return null
    if (s.weight <= 0 || s.reps < repRangeTop) return null
    if (weight == null) {
      weight = s.weight
    } else if (s.weight !== weight) {
      // Mixed weights → ambiguous; don't suggest.
      return null
    }
  }

  if (weight == null) return null

  return {
    previousWeight: weight,
    suggestedWeight: weight + increment,
    increment,
    repTarget: repRangeTop,
  }
}
