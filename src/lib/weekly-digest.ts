/**
 * Weekly coach digest: distills the week's signals across the three goals —
 * fitness (workouts/volume), weight (adaptive TDEE trend vs target), and
 * energy (avg energy + sleep) — into a short readout plus the 1–2
 * highest-impact actions for the week ahead. Pure so it's unit-tested; the
 * card gathers the inputs from the same sources the individual cards use.
 */

export interface DigestInput {
  workoutsThisWeek: number
  workoutsLastWeek: number
  // Weight (from the adaptive-TDEE engine).
  tdee: number | null
  weightTrendLbsPerWeek: number | null
  targetRateLbsPerWeek: number
  avgIntake: number | null
  targetIntake: number | null
  // Energy (1–5 average) and sleep.
  avgEnergyThisWeek: number | null
  avgEnergyLastWeek: number | null
  avgSleepHours: number | null
  sleepDeltaHours: number | null
  /** Strongest energy-driver message, if any. */
  topEnergyInsight: string | null
}

export type Tone = "good" | "neutral" | "warn"

export interface DigestSection {
  key: "fitness" | "weight" | "energy"
  headline: string
  detail?: string
  tone: Tone
}

export interface DigestAction {
  text: string
  priority: number
}

export interface WeeklyDigest {
  sections: DigestSection[]
  actions: DigestAction[]
}

function roundTo50(n: number): number {
  return Math.round(n / 50) * 50
}

function fitnessSection(i: DigestInput): DigestSection {
  const n = i.workoutsThisWeek
  const vs =
    i.workoutsLastWeek > 0 ? ` (${i.workoutsLastWeek} last week)` : ""
  return {
    key: "fitness",
    headline: `${n} workout${n === 1 ? "" : "s"} this week`,
    detail: vs ? `vs${vs.slice(1)}` : undefined,
    tone: n === 0 ? "warn" : n >= 3 ? "good" : "neutral",
  }
}

function weightSection(i: DigestInput): DigestSection {
  if (i.tdee == null || i.weightTrendLbsPerWeek == null) {
    return {
      key: "weight",
      headline: "Learning your maintenance calories",
      detail: "Keep logging weight and meals",
      tone: "neutral",
    }
  }
  const r = i.weightTrendLbsPerWeek
  const dir = r < 0 ? "down" : r > 0 ? "up" : "holding"
  const headline =
    dir === "holding"
      ? "Weight holding steady"
      : `Weight ${dir} ${Math.abs(r)} lb/wk`
  // On track if moving in the goal's direction, or holding when no goal move.
  const wantDir = i.targetRateLbsPerWeek
  const onTrack =
    wantDir === 0 ? Math.abs(r) < 0.5 : Math.sign(r) === Math.sign(wantDir)
  return {
    key: "weight",
    headline,
    detail: `~${i.tdee.toLocaleString()} cal/day maintenance`,
    tone: onTrack ? "good" : "warn",
  }
}

function energySection(i: DigestInput): DigestSection {
  if (i.avgEnergyThisWeek == null) {
    return {
      key: "energy",
      headline: "No energy check-ins yet",
      detail: "Log a few to unlock your patterns",
      tone: "neutral",
    }
  }
  const avg = i.avgEnergyThisWeek
  let detail: string | undefined
  if (i.avgEnergyLastWeek != null) {
    const d = Math.round((avg - i.avgEnergyLastWeek) * 10) / 10
    if (d !== 0) detail = `${d > 0 ? "+" : ""}${d} vs last week`
  }
  if (i.avgSleepHours != null) {
    const sleep = `${i.avgSleepHours}h avg sleep`
    detail = detail ? `${detail} · ${sleep}` : sleep
  }
  return {
    key: "energy",
    headline: `Energy ${Math.round(avg * 10) / 10}/5 this week`,
    detail,
    tone: avg >= 3.5 ? "good" : avg < 2.5 ? "warn" : "neutral",
  }
}

function buildActions(i: DigestInput): DigestAction[] {
  const actions: DigestAction[] = []

  // Workouts.
  if (i.workoutsThisWeek === 0) {
    actions.push({
      priority: 95,
      text: "No workouts logged this week — even one short session restarts your momentum.",
    })
  } else if (i.workoutsThisWeek < 3) {
    actions.push({
      priority: 80,
      text: `Only ${i.workoutsThisWeek} workout${i.workoutsThisWeek === 1 ? "" : "s"} this week — one more gets you to a solid 3.`,
    })
  }

  // Intake vs target.
  if (i.avgIntake != null && i.targetIntake != null) {
    const diff = i.avgIntake - i.targetIntake
    if (Math.abs(diff) >= 200) {
      const over = diff > 0
      actions.push({
        priority: 90,
        text: `You're averaging ~${i.avgIntake.toLocaleString()} cal/day — about ${roundTo50(
          Math.abs(diff)
        ).toLocaleString()} ${over ? "over" : "under"} your ~${i.targetIntake.toLocaleString()} target. ${
          over ? "Trim" : "Add"
        } ~${roundTo50(Math.abs(diff)).toLocaleString()}/day to stay on pace.`,
      })
    }
  }

  // Sleep.
  if (i.avgSleepHours != null && i.avgSleepHours < 7) {
    actions.push({
      priority: 70,
      text: `Sleep averaged ${i.avgSleepHours}h — getting to 7h+ is likely your biggest energy lever.`,
    })
  } else if (i.sleepDeltaHours != null && i.sleepDeltaHours <= -0.5) {
    actions.push({
      priority: 60,
      text: `Sleep dropped ${Math.abs(i.sleepDeltaHours)}h vs last week — protect bedtime this week.`,
    })
  }

  // Energy driver insight.
  if (i.topEnergyInsight) {
    actions.push({ priority: 50, text: i.topEnergyInsight })
  }

  if (actions.length === 0) {
    actions.push({
      priority: 10,
      text: "You're on track across the board — keep the streak going.",
    })
  }

  return actions.sort((a, b) => b.priority - a.priority).slice(0, 2)
}

export function buildWeeklyDigest(input: DigestInput): WeeklyDigest {
  return {
    sections: [
      fitnessSection(input),
      weightSection(input),
      energySection(input),
    ],
    actions: buildActions(input),
  }
}
