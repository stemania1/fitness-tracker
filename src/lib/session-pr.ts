/**
 * Does the set you just checked off beat everything before it?
 *
 * `personal-records.ts` answers "is this weight better than that one". This
 * answers the question the logger actually asks mid-workout, which needs one
 * more thing: the bar to clear is the best of your all-time history AND every
 * earlier completed set in this session. Without the second half, three sets
 * at the same new weight would each light up as a record.
 *
 * Assisted exercises invert throughout — the logged "weight" is machine help,
 * so LESS of it is the record — which is exactly the kind of asymmetry that
 * belongs somewhere testable rather than inline in a JSX map.
 */

import { isNewPersonalRecord, isNewAssistedRecord } from "./personal-records"

/** The parts of a set this needs; `ActiveSet` satisfies it. */
export interface SessionSet {
  weight: number | null
  reps: number | null
  completed: boolean
}

export interface SessionPrInput {
  /** Every set for the exercise, in display order. */
  sets: readonly SessionSet[]
  /** Index of the set being judged. */
  index: number
  /** True when the logged weight is machine assistance. */
  assisted: boolean
  /** All-time heaviest before this session (loaded exercises). */
  allTimeMaxWeight: number | null
  /** All-time lightest before this session (assisted exercises). */
  allTimeMinWeight: number | null
  /** Cardio records distance and time, not weight — never a weight PR. */
  isCardio: boolean
}

/**
 * The weight a set has to beat: the best of all-time history and the earlier
 * completed sets this session. Null when there's nothing to beat yet, which
 * makes any valid set a record.
 */
export function prThreshold(input: SessionPrInput): number | null {
  const { sets, index, assisted, allTimeMaxWeight, allTimeMinWeight } = input

  const earlier = sets
    .slice(0, index)
    .filter((s) => s.completed && s.weight != null)
    .map((s) => s.weight as number)

  const allTimeBest = assisted ? allTimeMinWeight : allTimeMaxWeight
  const candidates = allTimeBest != null ? [allTimeBest, ...earlier] : earlier
  if (candidates.length === 0) return null
  return assisted ? Math.min(...candidates) : Math.max(...candidates)
}

/**
 * Whether this set is a personal record — the trophy in the logger.
 *
 * Only completed sets qualify: a weight typed in but not checked off hasn't
 * been lifted.
 */
export function isSessionPersonalRecord(input: SessionPrInput): boolean {
  const set = input.sets[input.index]
  if (!set) return false
  if (input.isCardio) return false
  if (!set.completed) return false

  const threshold = prThreshold(input)
  const forPr = { weight: set.weight, reps: set.reps }
  return input.assisted
    ? isNewAssistedRecord(forPr, threshold)
    : isNewPersonalRecord(forPr, threshold)
}
