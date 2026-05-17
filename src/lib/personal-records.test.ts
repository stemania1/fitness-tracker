import { describe, it, expect } from "vitest"
import {
  estimateOneRepMax,
  findHeaviestWeight,
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
