import { describe, it, expect } from "vitest"
import {
  pearson,
  strengthOf,
  correlateDrivers,
  describeCorrelation,
  type DailyMetrics,
} from "./sleep-insights"

describe("pearson", () => {
  it("returns 1 for a perfect positive linear relationship", () => {
    const r = pearson([
      [1, 2],
      [2, 4],
      [3, 6],
      [4, 8],
    ])
    expect(r).toBeCloseTo(1, 10)
  })

  it("returns -1 for a perfect negative relationship", () => {
    const r = pearson([
      [1, 8],
      [2, 6],
      [3, 4],
      [4, 2],
    ])
    expect(r).toBeCloseTo(-1, 10)
  })

  it("returns ~0 for uncorrelated data", () => {
    // Symmetric inverted-V: no linear trend against x (r = 0 exactly).
    const r = pearson([
      [1, 2],
      [2, 4],
      [3, 5],
      [4, 4],
      [5, 2],
    ])
    expect(Math.abs(r!)).toBeLessThan(0.2)
  })

  it("returns null with fewer than 3 pairs", () => {
    expect(pearson([[1, 2]])).toBeNull()
    expect(
      pearson([
        [1, 2],
        [2, 3],
      ])
    ).toBeNull()
  })

  it("returns null when a series has zero variance", () => {
    const r = pearson([
      [5, 1],
      [5, 2],
      [5, 3],
    ])
    expect(r).toBeNull()
  })

  it("clamps to [-1, 1]", () => {
    const r = pearson([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
    expect(r).toBeLessThanOrEqual(1)
    expect(r).toBeGreaterThanOrEqual(-1)
  })
})

describe("strengthOf", () => {
  it("bins |r| conservatively", () => {
    expect(strengthOf(0.1)).toBe("none")
    expect(strengthOf(-0.1)).toBe("none")
    expect(strengthOf(0.3)).toBe("weak")
    expect(strengthOf(-0.5)).toBe("moderate")
    expect(strengthOf(0.8)).toBe("strong")
  })
})

function night(day: string, over: Partial<DailyMetrics>): DailyMetrics {
  return {
    day,
    remMinutes: null,
    remFraction: null,
    totalSleepMinutes: null,
    stressHighSeconds: null,
    activityScore: null,
    highActivityMinutes: null,
    readinessScore: null,
    averageHrv: null,
    ...over,
  }
}

describe("correlateDrivers", () => {
  it("finds a strong positive total-sleep→REM link and reports n", () => {
    const metrics = [
      night("d1", { totalSleepMinutes: 360, remFraction: 0.15 }),
      night("d2", { totalSleepMinutes: 420, remFraction: 0.18 }),
      night("d3", { totalSleepMinutes: 480, remFraction: 0.21 }),
      night("d4", { totalSleepMinutes: 540, remFraction: 0.24 }),
    ]
    const totalSleep = correlateDrivers(metrics).find(
      (c) => c.key === "totalSleep"
    )!
    expect(totalSleep.n).toBe(4)
    expect(totalSleep.direction).toBe("positive")
    expect(totalSleep.strength).toBe("strong")
    expect(totalSleep.r).toBeGreaterThan(0.6)
  })

  it("only counts nights where both values are present", () => {
    const metrics = [
      night("d1", { stressHighSeconds: 1000, remFraction: 0.2 }),
      night("d2", { stressHighSeconds: null, remFraction: 0.18 }),
      night("d3", { stressHighSeconds: 2000, remFraction: 0.15 }),
      night("d4", { stressHighSeconds: 3000, remFraction: 0.12 }),
    ]
    const stress = correlateDrivers(metrics).find((c) => c.key === "stress")!
    expect(stress.n).toBe(3)
    expect(stress.direction).toBe("negative")
  })

  it("reports null r with too few usable pairs", () => {
    const metrics = [
      night("d1", { readinessScore: 80, remFraction: 0.2 }),
      night("d2", { readinessScore: 70, remFraction: 0.18 }),
    ]
    const readiness = correlateDrivers(metrics).find(
      (c) => c.key === "readiness"
    )!
    expect(readiness.r).toBeNull()
    expect(readiness.n).toBe(2)
  })
})

describe("describeCorrelation", () => {
  it("explains a not-enough-data case", () => {
    const text = describeCorrelation({
      key: "stress",
      label: "Daytime stress",
      positiveMeans: "",
      r: null,
      n: 2,
      strength: "none",
      direction: null,
    })
    expect(text).toMatch(/not enough nights/i)
  })

  it("explains a meaningful negative link in plain English", () => {
    const text = describeCorrelation({
      key: "stress",
      label: "Daytime stress",
      positiveMeans: "",
      r: -0.55,
      n: 30,
      strength: "moderate",
      direction: "negative",
    })
    expect(text).toMatch(/moderate link/i)
    expect(text).toMatch(/less REM/i)
    expect(text).toMatch(/30 nights/)
  })

  it("explains no-meaningful-link", () => {
    const text = describeCorrelation({
      key: "hrv",
      label: "HRV",
      positiveMeans: "",
      r: 0.05,
      n: 20,
      strength: "none",
      direction: "positive",
    })
    expect(text).toMatch(/no meaningful link/i)
  })
})
