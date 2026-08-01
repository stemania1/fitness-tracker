/**
 * Fitness field-test helpers: Cooper-test VO2 Max estimation, the merged
 * Cooper + Oura series behind the VO2 Max trend chart, and the conversion of
 * a Cooper test into a loggable workout.
 */
import type { WorkoutPayload } from "@/lib/save-workout"
import { localDateString } from "@/lib/dates"

export type FitnessTestType = "cooper_run" | "pullup_max"

/** The columns of a fitness_tests row the trend logic needs. */
export interface FitnessTestEntry {
  test_type: FitnessTestType
  /** cooper_run: meters covered in 12 min; pullup_max: strict reps. */
  result: number
  /** YYYY-MM-DD */
  tested_at: string
}

/** A single day's Oura VO2 Max estimate. */
export interface OuraVo2Sample {
  /** YYYY-MM-DD */
  day: string
  vo2_max: number
}

/**
 * Estimate VO2 Max (ml/kg/min) from a Cooper 12-minute test.
 * Standard Cooper formula: (distance_m − 504.9) / 44.73.
 * Returns null for distances at or below the formula's zero point —
 * those indicate a mis-entered result, not a plausible test.
 */
export function cooperVo2Max(distanceMeters: number): number | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 504.9) return null
  return Math.round(((distanceMeters - 504.9) / 44.73) * 10) / 10
}

export interface Vo2TrendPoint {
  /** YYYY-MM-DD */
  day: string
  /** Cooper-test estimate, when a test was logged that day. */
  cooper?: number
  /** Oura's daily estimate, when the ring produced one. */
  oura?: number
}

/**
 * Merge Cooper-test results and Oura daily estimates into a single
 * date-sorted series. Days appearing in both sources yield one point with
 * both values. Non-Cooper tests and unusable Cooper distances are skipped.
 */
export function buildVo2Trend(
  tests: FitnessTestEntry[],
  ouraSamples: OuraVo2Sample[]
): Vo2TrendPoint[] {
  const byDay = new Map<string, Vo2TrendPoint>()

  const point = (day: string): Vo2TrendPoint => {
    let p = byDay.get(day)
    if (!p) {
      p = { day }
      byDay.set(day, p)
    }
    return p
  }

  for (const sample of ouraSamples) {
    if (sample.vo2_max != null) point(sample.day).oura = sample.vo2_max
  }

  for (const test of tests) {
    if (test.test_type !== "cooper_run") continue
    const vo2 = cooperVo2Max(test.result)
    if (vo2 != null) point(test.tested_at).cooper = vo2
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

/**
 * Most recent pull-up max test, for the stat shown beside the trend chart.
 */
export function latestPullupMax(
  tests: FitnessTestEntry[]
): { reps: number; tested_at: string } | null {
  let latest: { reps: number; tested_at: string } | null = null
  for (const test of tests) {
    if (test.test_type !== "pullup_max") continue
    if (!latest || test.tested_at > latest.tested_at) {
      latest = { reps: test.result, tested_at: test.tested_at }
    }
  }
  return latest
}

/** Meters in a statute mile. */
export const METERS_PER_MILE = 1609.344

/** The Cooper protocol's measured effort, excluding the warm-up. */
export const COOPER_TEST_MINUTES = 12

/**
 * A Cooper test as a workout payload.
 *
 * A logged fitness test wrote only to `fitness_tests`, so a maximal 12-minute
 * effort counted for nothing: not the week's workout total, not the streak,
 * not calories, not Recent Workouts. Worse, the Cooper *replaces* Saturday's
 * intervals, so outside the three designated test weeks the missed-session
 * detector would flag that slot as skipped — telling you that you missed the
 * session you had just gone maximal on.
 *
 * Only the Cooper converts. The pull-up max is done as the first exercise of
 * a Pull A session that gets logged on its own, so minting a second workout
 * for it would double-count the day.
 *
 * The warm-up is deliberately not included: the test record knows the 12
 * minutes and the distance, and nothing else. Inventing a warm-up length
 * would put a number in the log that the user never reported. They can edit
 * the workout afterwards if they want it counted.
 */
export function cooperWorkoutPayload(opts: {
  userId: string
  /** Distance covered in 12 minutes, in meters. */
  distanceMeters: number
  /** Local calendar day of the test, YYYY-MM-DD. */
  testedAt: string
  /** Injected so the result is deterministic under test. */
  now?: Date
}): WorkoutPayload {
  const { userId, distanceMeters, testedAt } = opts
  const now = opts.now ?? new Date()

  // Anchor to the test's own day. For a backdated test we have no clock time,
  // so use midday — late enough to stay on the right local day in any zone.
  const isToday = testedAt === localDateString(now)
  const finishedAt = isToday ? now : new Date(`${testedAt}T12:00:00`)
  const startedAt = new Date(
    finishedAt.getTime() - COOPER_TEST_MINUTES * 60_000
  )

  return {
    userId,
    name: "Cooper 12-min test",
    templateId: null,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMins: COOPER_TEST_MINUTES,
    appendToLogId: null,
    orderOffset: 0,
    exercises: [
      {
        exerciseId: "treadmill-run",
        notes: "Cooper 12-minute test — max distance at 1% incline.",
        orderIndex: 0,
        completedSets: [
          {
            reps: null,
            weight: null,
            durationMins: COOPER_TEST_MINUTES,
            distanceMiles:
              Math.round((distanceMeters / METERS_PER_MILE) * 100) / 100,
            inclinePercent: 1,
            rpe: null,
          },
        ],
      },
    ],
  }
}
