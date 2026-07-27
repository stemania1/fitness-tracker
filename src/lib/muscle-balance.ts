/**
 * Muscle-group balance. Training drifts — it's easy to accumulate pressing
 * volume and quietly under-train the pull side, or skip legs on the weeks
 * time is tight. This turns logged sets into a volume share per muscle group
 * plus the classic balance ratios (push:pull, upper:lower), and flags what's
 * been neglected.
 *
 * Pure so it's unit-tested; the card resolves logged exercises to their
 * catalog muscle groups and feeds the sets in.
 */

import { formatMuscleGroup } from "./muscle-groups"

export interface MuscleSet {
  /** Canonical muscle groups the set worked. */
  muscleGroups: string[]
  /** Set volume, e.g. weight × reps. */
  volume: number
}

export interface GroupVolume {
  group: string
  label: string
  volume: number
  /** Percent of total volume, 0-100. */
  sharePct: number
}

export type BalanceVerdict = "balanced" | "skewed" | "insufficient"

export interface BalanceRatio {
  key: "push_pull" | "upper_lower"
  leftLabel: string
  rightLabel: string
  leftVolume: number
  rightVolume: number
  /** left ÷ right, rounded to 2dp. Null when either side is empty. */
  ratio: number | null
  verdict: BalanceVerdict
  message: string
}

export interface MuscleBalance {
  groups: GroupVolume[]
  ratios: BalanceRatio[]
  /** Tracked groups with little or no volume, most-neglected first. */
  neglected: string[]
  totalVolume: number
  setCount: number
}

const PUSH = ["chest", "shoulders", "triceps"]
const PULL = ["back", "lats", "biceps"]
const LOWER = ["quads", "hamstrings", "glutes", "calves"]

/** Groups we expect a balanced program to touch. */
const TRACKED = [...PUSH, ...PULL, ...LOWER, "core"]

/** A ratio outside this band reads as skewed. */
const SKEW_HIGH = 1.5
const SKEW_LOW = 1 / SKEW_HIGH
/** Below this share of total volume, a tracked group counts as neglected. */
const NEGLECT_SHARE_PCT = 5
/** Not enough logged work to say anything useful. */
const MIN_SETS = 8

function round(n: number): number {
  return Math.round(n)
}

function sumGroups(byGroup: Map<string, number>, groups: string[]): number {
  return groups.reduce((sum, g) => sum + (byGroup.get(g) ?? 0), 0)
}

function ratioFor(
  key: BalanceRatio["key"],
  leftLabel: string,
  rightLabel: string,
  left: number,
  right: number,
  skewedHighMsg: string,
  skewedLowMsg: string
): BalanceRatio {
  if (left <= 0 || right <= 0) {
    const missing = left <= 0 ? leftLabel : rightLabel
    return {
      key,
      leftLabel,
      rightLabel,
      leftVolume: round(left),
      rightVolume: round(right),
      ratio: null,
      verdict: "insufficient",
      message: `No ${missing.toLowerCase()} volume logged yet.`,
    }
  }
  const ratio = Math.round((left / right) * 100) / 100
  if (ratio > SKEW_HIGH) {
    return {
      key,
      leftLabel,
      rightLabel,
      leftVolume: round(left),
      rightVolume: round(right),
      ratio,
      verdict: "skewed",
      message: skewedHighMsg,
    }
  }
  if (ratio < SKEW_LOW) {
    return {
      key,
      leftLabel,
      rightLabel,
      leftVolume: round(left),
      rightVolume: round(right),
      ratio,
      verdict: "skewed",
      message: skewedLowMsg,
    }
  }
  return {
    key,
    leftLabel,
    rightLabel,
    leftVolume: round(left),
    rightVolume: round(right),
    ratio,
    verdict: "balanced",
    message: `${leftLabel} and ${rightLabel.toLowerCase()} volume are in balance.`,
  }
}

/**
 * Volume share per muscle group + balance ratios. A set working several
 * groups splits its volume evenly across them, so shares sum to 100% instead
 * of double-counting compound lifts.
 */
export function analyzeMuscleBalance(sets: MuscleSet[]): MuscleBalance {
  const byGroup = new Map<string, number>()
  let totalVolume = 0
  let setCount = 0

  for (const s of sets) {
    const groups = s.muscleGroups.filter((g) => g && g !== "full_body")
    if (groups.length === 0 || s.volume <= 0) continue
    setCount++
    const per = s.volume / groups.length
    for (const g of groups) {
      byGroup.set(g, (byGroup.get(g) ?? 0) + per)
      totalVolume += per
    }
  }

  const groups: GroupVolume[] = [...byGroup.entries()]
    .map(([group, volume]) => ({
      group,
      label: formatMuscleGroup(group),
      volume: round(volume),
      sharePct:
        totalVolume > 0 ? Math.round((volume / totalVolume) * 100) : 0,
    }))
    .sort((a, b) => b.volume - a.volume)

  const push = sumGroups(byGroup, PUSH)
  const pull = sumGroups(byGroup, PULL)
  const upper = push + pull
  const lower = sumGroups(byGroup, LOWER)

  const ratios: BalanceRatio[] =
    setCount < MIN_SETS
      ? []
      : [
          ratioFor(
            "push_pull",
            "Push",
            "Pull",
            push,
            pull,
            "Pressing is outpacing pulling — add rows or pulldowns to protect your shoulders and posture.",
            "Pulling is outpacing pressing — add a press to even it out."
          ),
          ratioFor(
            "upper_lower",
            "Upper",
            "Lower",
            upper,
            lower,
            "Upper body is well ahead of legs — a squat or hinge session would close the gap.",
            "Legs are well ahead of upper body — add an upper session to even it out."
          ),
        ]

  const neglected =
    setCount < MIN_SETS
      ? []
      : TRACKED.filter((g) => {
          const share = groups.find((x) => x.group === g)?.sharePct ?? 0
          return share < NEGLECT_SHARE_PCT
        }).sort(
          (a, b) =>
            (groups.find((x) => x.group === a)?.sharePct ?? 0) -
            (groups.find((x) => x.group === b)?.sharePct ?? 0)
        )

  return { groups, ratios, neglected, totalVolume: round(totalVolume), setCount }
}
