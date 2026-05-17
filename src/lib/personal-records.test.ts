import { describe, it, expect } from "vitest"
import {
  estimateOneRepMax,
  findHeaviestWeight,
  findRecentPRs,
  findRecentRepPRs,
  isNewPersonalRecord,
} from "./personal-records"

describe("estimateOneRepMax", () => {
  it("returns the weight when reps = 1", () => {
    expect(estimateOneRepMax(225, 1)).toBe(225)
  })

  it("applies Epley for multi-rep sets", () => {
    // 100 × (1 + 10/30) ≈ 133.33
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.333, 2)
  })

  it("returns null for missing or invalid input", () => {
    expect(estimateOneRepMax(null, 5)).toBeNull()
    expect(estimateOneRepMax(100, null)).toBeNull()
    expect(estimateOneRepMax(0, 5)).toBeNull()
    expect(estimateOneRepMax(100, 0)).toBeNull()
    expect(estimateOneRepMax(-5, 5)).toBeNull()
  })
})

describe("findHeaviestWeight", () => {
  it("returns the max weight regardless of reps", () => {
    const sets = [
      { weight: 25, reps: 10 },
      { weight: 30, reps: 5 },
      { weight: 25, reps: 5 },
      { weight: 25, reps: 10 },
    ]
    expect(findHeaviestWeight(sets)).toBe(30)
  })

  it("ignores sets with missing data", () => {
    const sets = [
      { weight: null, reps: 10 },
      { weight: 40, reps: null },
      { weight: 30, reps: 5 },
    ]
    expect(findHeaviestWeight(sets)).toBe(30)
  })

  it("returns null when no valid sets", () => {
    expect(findHeaviestWeight([])).toBeNull()
    expect(findHeaviestWeight([{ weight: null, reps: null }])).toBeNull()
  })
})

describe("isNewPersonalRecord", () => {
  it("is true when previous max is null (first time)", () => {
    expect(isNewPersonalRecord({ weight: 25, reps: 10 }, null)).toBe(true)
  })

  it("is true when strictly heavier than previous max", () => {
    expect(isNewPersonalRecord({ weight: 30, reps: 5 }, 25)).toBe(true)
  })

  it("is false when equal to previous max", () => {
    expect(isNewPersonalRecord({ weight: 25, reps: 10 }, 25)).toBe(false)
  })

  it("is false when lighter than previous max", () => {
    expect(isNewPersonalRecord({ weight: 20, reps: 12 }, 25)).toBe(false)
  })

  it("ignores invalid sets", () => {
    expect(isNewPersonalRecord({ weight: null, reps: 10 }, 25)).toBe(false)
    expect(isNewPersonalRecord({ weight: 30, reps: 0 }, 25)).toBe(false)
  })
})

describe("findRecentPRs", () => {
  const now = new Date("2026-05-17T12:00:00Z")
  const day = (n: number) =>
    new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

  it("returns the latest PR per exercise within the window", () => {
    const sets = [
      { exerciseName: "Curl", weight: 20, reps: 10, startedAt: day(60) },
      // 25 lbs PR set 40 days ago — outside 30-day window
      { exerciseName: "Curl", weight: 25, reps: 10, startedAt: day(40) },
      // 30 lbs PR 10 days ago — inside window
      { exerciseName: "Curl", weight: 30, reps: 8, startedAt: day(10) },
      // 35 lbs PR 2 days ago — newer, should win for this exercise
      { exerciseName: "Curl", weight: 35, reps: 5, startedAt: day(2) },
    ]
    const result = findRecentPRs(sets, 30, now)
    expect(result).toHaveLength(1)
    expect(result[0].exerciseName).toBe("Curl")
    expect(result[0].weight).toBe(35)
    expect(result[0].previousMaxWeight).toBe(30)
  })

  it("returns the first-ever set for a new exercise (it is the PR)", () => {
    const sets = [
      { exerciseName: "Row", weight: 100, reps: 8, startedAt: day(20) },
      // Equal weight doesn't count as a new PR.
      { exerciseName: "Row", weight: 100, reps: 10, startedAt: day(5) },
      { exerciseName: "Row", weight: 90, reps: 12, startedAt: day(2) },
    ]
    const result = findRecentPRs(sets, 30, now)
    expect(result).toHaveLength(1)
    expect(result[0].weight).toBe(100)
    expect(result[0].previousMaxWeight).toBeNull()
  })

  it("returns multiple exercises sorted by recency", () => {
    const sets = [
      { exerciseName: "Bench", weight: 135, reps: 5, startedAt: day(10) },
      { exerciseName: "Squat", weight: 185, reps: 5, startedAt: day(3) },
    ]
    const result = findRecentPRs(sets, 30, now)
    expect(result.map((r) => r.exerciseName)).toEqual(["Squat", "Bench"])
  })

  it("excludes PRs set before the window", () => {
    const sets = [
      { exerciseName: "Press", weight: 95, reps: 5, startedAt: day(120) },
    ]
    expect(findRecentPRs(sets, 30, now)).toEqual([])
  })

  it("skips invalid sets", () => {
    const sets = [
      { exerciseName: "Curl", weight: null, reps: 10, startedAt: day(5) },
      { exerciseName: "Curl", weight: 25, reps: null, startedAt: day(5) },
      { exerciseName: "Curl", weight: 0, reps: 10, startedAt: day(5) },
    ]
    expect(findRecentPRs(sets, 30, now)).toEqual([])
  })
})

describe("findRecentRepPRs", () => {
  const now = new Date("2026-05-17T12:00:00Z")
  const day = (n: number) =>
    new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

  it("returns a rep PR when reps beat the prior max at the same weight", () => {
    const sets = [
      { exerciseName: "Curl", weight: 25, reps: 8, startedAt: day(60) },
      { exerciseName: "Curl", weight: 25, reps: 10, startedAt: day(40) },
      // Recent rep PR at the same weight
      { exerciseName: "Curl", weight: 25, reps: 12, startedAt: day(5) },
    ]
    const result = findRecentRepPRs(sets, 30, now)
    expect(result).toHaveLength(1)
    expect(result[0].weight).toBe(25)
    expect(result[0].reps).toBe(12)
    expect(result[0].previousMaxReps).toBe(10)
  })

  it("ignores the first ever set at a weight (no prior to beat)", () => {
    const sets = [
      { exerciseName: "Row", weight: 100, reps: 5, startedAt: day(5) },
    ]
    expect(findRecentRepPRs(sets, 30, now)).toEqual([])
  })

  it("ignores singles (1RM attempts aren't rep PRs)", () => {
    const sets = [
      { exerciseName: "Bench", weight: 135, reps: 1, startedAt: day(40) },
      { exerciseName: "Bench", weight: 135, reps: 1, startedAt: day(5) },
    ]
    expect(findRecentRepPRs(sets, 30, now)).toEqual([])
  })

  it("returns the latest rep PR per exercise", () => {
    const sets = [
      { exerciseName: "Curl", weight: 25, reps: 8, startedAt: day(60) },
      { exerciseName: "Curl", weight: 25, reps: 10, startedAt: day(20) },
      // Another rep PR more recently — should win
      { exerciseName: "Curl", weight: 25, reps: 12, startedAt: day(2) },
    ]
    const result = findRecentRepPRs(sets, 30, now)
    expect(result).toHaveLength(1)
    expect(result[0].reps).toBe(12)
  })

  it("tracks rep maxes separately per weight", () => {
    const sets = [
      // At 25 lbs: 10 reps is a PR (prev 8)
      { exerciseName: "Curl", weight: 25, reps: 8, startedAt: day(60) },
      { exerciseName: "Curl", weight: 25, reps: 10, startedAt: day(5) },
      // At 30 lbs: 6 reps first time — not a PR yet
      { exerciseName: "Curl", weight: 30, reps: 6, startedAt: day(3) },
    ]
    const result = findRecentRepPRs(sets, 30, now)
    expect(result).toHaveLength(1)
    expect(result[0].weight).toBe(25)
    expect(result[0].reps).toBe(10)
  })

  it("excludes rep PRs outside the window", () => {
    const sets = [
      { exerciseName: "Curl", weight: 25, reps: 8, startedAt: day(100) },
      { exerciseName: "Curl", weight: 25, reps: 10, startedAt: day(60) },
    ]
    expect(findRecentRepPRs(sets, 30, now)).toEqual([])
  })
})
