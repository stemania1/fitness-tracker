/**
 * Adaptive per-exercise targets: turn what you actually logged last session
 * into a recommended weight for the next one, so the prescribed workout moves
 * with your performance instead of staying static.
 *
 *   - progress — you cleared the top of the rep range on every set → add weight
 *   - repeat   — you worked inside the range → match last time, chase the top
 *   - hold     — you fell short of the range → stay put and nail the reps first
 *   - new      — no usable history → fall back to the plan's suggestion
 *
 * Suggestion-only and transparent: every target carries a short reason so the
 * user can see why, and override it.
 */

import {
  getOverloadSuggestion,
  parseRepRange,
  type PreviousSet,
} from "./progressive-overload"

export type AdaptReason = "progress" | "repeat" | "hold" | "new"

export interface AdaptiveTarget {
  /** Recommended weight for the next session, or null when unknown. */
  weight: number | null
  reason: AdaptReason
  /** Short chip label, e.g. "Progress +5 lb". */
  label: string
  /** One-line explanation. */
  note: string
}

export interface AdaptiveTargetInput {
  /** Working sets from the most recent logged session for this exercise. */
  previousSets: PreviousSet[]
  /** Prescribed rep range, e.g. "8-12". */
  repRange: string | null | undefined
  /** Weight increment for progression (lbs) — size via suggestedIncrement(). */
  increment: number
  /** Weight to use when there's no usable history (the plan's preset). */
  fallbackWeight?: number | null
  /** When true, "weight" is machine assistance: progress means DROPPING it. */
  assisted?: boolean
}

export function adaptiveTarget({
  previousSets,
  repRange,
  increment,
  fallbackWeight = null,
  assisted = false,
}: AdaptiveTargetInput): AdaptiveTarget {
  const range = parseRepRange(repRange)

  // Progress (load exercises): reuse the strict overload check — all sets hit
  // the top of the range at one consistent weight → add weight.
  if (!assisted) {
    const overload = getOverloadSuggestion(previousSets, range?.top ?? null, increment)
    if (overload) {
      return {
        weight: overload.suggestedWeight,
        reason: "progress",
        label: `Progress +${increment} lb`,
        note: `You cleared ${overload.repTarget}+ reps on every set at ${overload.previousWeight} lb last time — go for ${overload.suggestedWeight} lb.`,
      }
    }
  }

  const valid = previousSets.filter(
    (s): s is { weight: number; reps: number } =>
      s.weight != null && s.weight > 0 && s.reps != null
  )
  if (valid.length === 0) {
    return {
      weight: fallbackWeight,
      reason: "new",
      label: "New",
      note: "No recent history for this lift — start where the plan suggests and log it.",
    }
  }

  const minReps = Math.min(...valid.map((s) => s.reps))
  // Conservative reference weight: for load, the lightest sustained set; for
  // assistance, the MOST assistance used (so we don't jump to a set that's too
  // hard). The worst set's reps decide whether progression is earned.
  const reference = assisted
    ? Math.max(...valid.map((s) => s.weight))
    : Math.min(...valid.map((s) => s.weight))

  const hitTop = range != null && minReps >= range.top
  const missed = range != null && minReps < range.bottom

  if (assisted) {
    if (hitTop) {
      const next = Math.max(0, reference - increment)
      return {
        weight: next,
        reason: "progress",
        label: `Progress −${increment} lb assist`,
        note: `You cleared ${range!.top}+ reps at ${reference} lb of assistance — drop to ${next} lb (less help).`,
      }
    }
    if (missed) {
      return {
        weight: reference,
        reason: "hold",
        label: "Hold",
        note: `Last time you fell short of ${range!.bottom} reps — keep ${reference} lb of assistance and nail the reps first.`,
      }
    }
    return {
      weight: reference,
      reason: "repeat",
      label: "Repeat",
      note: range
        ? `Stay at ${reference} lb of assistance and push toward ${range.top} reps before dropping it.`
        : `Match last session at ${reference} lb of assistance.`,
    }
  }

  if (missed) {
    return {
      weight: reference,
      reason: "hold",
      label: "Hold",
      note: `Last time you came up short of ${range!.bottom} reps — stay at ${reference} lb and nail the reps before adding weight.`,
    }
  }

  return {
    weight: reference,
    reason: "repeat",
    label: "Repeat",
    note: range
      ? `Match last session at ${reference} lb and push toward ${range.top} reps on every set.`
      : `Match last session at ${reference} lb.`,
  }
}
