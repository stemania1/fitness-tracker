import { describe, it, expect } from "vitest"
import {
  cooperVo2Max,
  buildVo2Trend,
  latestPullupMax,
  type FitnessTestEntry,  cooperWorkoutPayload,  cooperDistanceToMeters,
  metersToMiles,
} from "./fitness-tests"
import { localDateString } from "@/lib/dates"

describe("cooperVo2Max", () => {
  it("applies the Cooper formula and rounds to one decimal", () => {
    // 2400 m: (2400 - 504.9) / 44.73 = 42.368... → 42.4
    expect(cooperVo2Max(2400)).toBe(42.4)
    // 2000 m: (2000 - 504.9) / 44.73 = 33.425... → 33.4
    expect(cooperVo2Max(2000)).toBe(33.4)
  })

  it("returns null at or below the formula zero point", () => {
    expect(cooperVo2Max(504.9)).toBeNull()
    expect(cooperVo2Max(300)).toBeNull()
    expect(cooperVo2Max(0)).toBeNull()
    expect(cooperVo2Max(-100)).toBeNull()
  })

  it("returns null for non-finite input", () => {
    expect(cooperVo2Max(NaN)).toBeNull()
    expect(cooperVo2Max(Infinity)).toBeNull()
  })
})

describe("buildVo2Trend", () => {
  const cooper = (tested_at: string, result: number): FitnessTestEntry => ({
    test_type: "cooper_run",
    result,
    tested_at,
  })

  it("returns an empty series for no data", () => {
    expect(buildVo2Trend([], [])).toEqual([])
  })

  it("merges Cooper and Oura values on the same day into one point", () => {
    const trend = buildVo2Trend(
      [cooper("2026-07-12", 2400)],
      [{ day: "2026-07-12", vo2_max: 41.0 }]
    )
    expect(trend).toEqual([{ day: "2026-07-12", cooper: 42.4, oura: 41.0 }])
  })

  it("sorts points by day ascending across both sources", () => {
    const trend = buildVo2Trend(
      [cooper("2026-08-16", 2500)],
      [
        { day: "2026-09-01", vo2_max: 44 },
        { day: "2026-07-12", vo2_max: 40 },
      ]
    )
    expect(trend.map((p) => p.day)).toEqual([
      "2026-07-12",
      "2026-08-16",
      "2026-09-01",
    ])
  })

  it("skips pull-up tests and unusable Cooper distances", () => {
    const trend = buildVo2Trend(
      [
        { test_type: "pullup_max", result: 5, tested_at: "2026-07-11" },
        cooper("2026-07-12", 400), // below formula zero point
      ],
      []
    )
    expect(trend).toEqual([])
  })
})

describe("latestPullupMax", () => {
  it("returns null when there are no pull-up tests", () => {
    expect(latestPullupMax([])).toBeNull()
    expect(
      latestPullupMax([
        { test_type: "cooper_run", result: 2400, tested_at: "2026-07-12" },
      ])
    ).toBeNull()
  })

  it("returns the most recent pull-up test regardless of input order", () => {
    const tests: FitnessTestEntry[] = [
      { test_type: "pullup_max", result: 8, tested_at: "2026-08-15" },
      { test_type: "pullup_max", result: 3, tested_at: "2026-07-11" },
      { test_type: "cooper_run", result: 2400, tested_at: "2026-09-26" },
    ]
    expect(latestPullupMax(tests)).toEqual({
      reps: 8,
      tested_at: "2026-08-15",
    })
  })
})

describe("cooperWorkoutPayload", () => {
  const now = new Date(2026, 7, 1, 9, 30) // Sat 1 Aug 2026, 09:30 local

  it("converts the distance to miles", () => {
    const p = cooperWorkoutPayload({
      userId: "u1",
      distanceMeters: 1963.4, // 1.22 miles
      testedAt: "2026-08-01",
      now,
    })
    expect(p.exercises[0].completedSets[0].distanceMiles).toBe(1.22)
  })

  it("logs the 12 measured minutes, not an invented warm-up", () => {
    const p = cooperWorkoutPayload({
      userId: "u1",
      distanceMeters: 2400,
      testedAt: "2026-08-01",
      now,
    })
    expect(p.durationMins).toBe(12)
    expect(p.exercises[0].completedSets[0].durationMins).toBe(12)
    const span =
      new Date(p.finishedAt).getTime() - new Date(p.startedAt).getTime()
    expect(span).toBe(12 * 60_000)
  })

  it("records the protocol's 1% incline", () => {
    const p = cooperWorkoutPayload({
      userId: "u1",
      distanceMeters: 2400,
      testedAt: "2026-08-01",
      now,
    })
    expect(p.exercises[0].completedSets[0].inclinePercent).toBe(1)
  })

  it("ends at the current time for a test logged today", () => {
    const p = cooperWorkoutPayload({
      userId: "u1",
      distanceMeters: 2400,
      testedAt: "2026-08-01",
      now,
    })
    expect(new Date(p.finishedAt).getTime()).toBe(now.getTime())
  })

  it("anchors a backdated test to its own day, not today", () => {
    const p = cooperWorkoutPayload({
      userId: "u1",
      distanceMeters: 2400,
      testedAt: "2026-07-25",
      now,
    })
    // Midday on the tested day, so it stays on that local day in any zone.
    expect(localDateString(new Date(p.finishedAt))).toBe("2026-07-25")
  })

  it("uses the treadmill and names itself recognisably", () => {
    const p = cooperWorkoutPayload({
      userId: "u1",
      distanceMeters: 2400,
      testedAt: "2026-08-01",
      now,
    })
    expect(p.name).toMatch(/cooper/i)
    expect(p.exercises[0].exerciseId).toBe("treadmill-run")
    expect(p.appendToLogId).toBeNull()
  })

  it("maps to a real catalog exercise id", async () => {
    const { exercises } = await import("@/data/exercises")
    const p = cooperWorkoutPayload({
      userId: "u1",
      distanceMeters: 2400,
      testedAt: "2026-08-01",
      now,
    })
    expect(exercises.some((e) => e.id === p.exercises[0].exerciseId)).toBe(true)
  })
})

describe("cooperDistanceToMeters", () => {
  it("converts miles to meters", () => {
    expect(cooperDistanceToMeters(1.22, "mi")).toBe(1963.4)
    expect(cooperDistanceToMeters(1, "mi")).toBe(1609.3)
  })

  it("passes meters through unchanged", () => {
    expect(cooperDistanceToMeters(2400, "m")).toBe(2400)
  })

  it("rejects values that would store as NaN or nonsense", () => {
    expect(cooperDistanceToMeters(0, "mi")).toBeNull()
    expect(cooperDistanceToMeters(-1, "m")).toBeNull()
    expect(cooperDistanceToMeters(Number.NaN, "mi")).toBeNull()
  })

  it("round-trips against metersToMiles", () => {
    const meters = cooperDistanceToMeters(1.22, "mi")!
    expect(metersToMiles(meters)).toBe(1.22)
  })

  it("gives the same VO2 whichever unit was typed", () => {
    const fromMiles = cooperVo2Max(cooperDistanceToMeters(1.22, "mi")!)
    const fromMeters = cooperVo2Max(cooperDistanceToMeters(1963.4, "m")!)
    expect(fromMiles).toBe(fromMeters)
  })
})
