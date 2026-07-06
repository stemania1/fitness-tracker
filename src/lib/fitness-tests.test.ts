import { describe, it, expect } from "vitest"
import {
  cooperVo2Max,
  buildVo2Trend,
  latestPullupMax,
  type FitnessTestEntry,
} from "./fitness-tests"

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
