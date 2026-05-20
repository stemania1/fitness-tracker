import { describe, it, expect } from "vitest"
import {
  formatCardioSets,
  formatStrengthSets,
} from "./previous-performance-format"
import type { PreviousSetRow } from "@/hooks/useExerciseHistory"

const blank = {
  duration_mins: null,
  distance_miles: null,
  incline_percent: null,
} as const

function strengthSet(
  set_number: number,
  reps: number | null,
  weight: number | null
): PreviousSetRow {
  return { set_number, reps, weight, ...blank }
}

function cardioSet(
  set_number: number,
  duration_mins: number | null,
  distance_miles: number | null
): PreviousSetRow {
  return {
    set_number,
    reps: null,
    weight: null,
    duration_mins,
    distance_miles,
    incline_percent: null,
  }
}

describe("formatStrengthSets", () => {
  it("joins each set as 'W lbs × N' with commas", () => {
    const out = formatStrengthSets([
      strengthSet(1, 10, 100),
      strengthSet(2, 8, 110),
      strengthSet(3, 6, 120),
    ])
    expect(out).toBe("100 lbs × 10, 110 lbs × 8, 120 lbs × 6")
  })

  it("renders bodyweight sets (null weight) as 'BW × N'", () => {
    expect(formatStrengthSets([strengthSet(1, 15, null)])).toBe("BW × 15")
  })

  it("renders missing rep counts as '?'", () => {
    expect(formatStrengthSets([strengthSet(1, null, 100)])).toBe("100 lbs × ?")
  })

  it("renders a set with both fields null as 'BW × ?'", () => {
    expect(formatStrengthSets([strengthSet(1, null, null)])).toBe("BW × ?")
  })

  it("returns an empty string for an empty array", () => {
    expect(formatStrengthSets([])).toBe("")
  })

  it("handles a zero-rep set (renders the 0, doesn't treat as missing)", () => {
    // null is "missing"; 0 is a valid (if weird) value the formatter shows.
    expect(formatStrengthSets([strengthSet(1, 0, 100)])).toBe("100 lbs × 0")
  })
})

describe("formatCardioSets", () => {
  it("sums minutes and miles across all sets", () => {
    expect(
      formatCardioSets([cardioSet(1, 10, 1), cardioSet(2, 15, 2)])
    ).toBe("25 min, 3 mi")
  })

  it("omits distance when no miles were logged", () => {
    expect(formatCardioSets([cardioSet(1, 30, 0)])).toBe("30 min")
  })

  it("omits duration when no minutes were logged", () => {
    expect(formatCardioSets([cardioSet(1, 0, 2)])).toBe("2 mi")
  })

  it("treats null minutes/miles as zero", () => {
    expect(
      formatCardioSets([cardioSet(1, null, null), cardioSet(2, 20, 1.5)])
    ).toBe("20 min, 1.5 mi")
  })

  it("returns an empty string when no totals are positive", () => {
    expect(formatCardioSets([cardioSet(1, 0, 0)])).toBe("")
    expect(formatCardioSets([cardioSet(1, null, null)])).toBe("")
    expect(formatCardioSets([])).toBe("")
  })
})
