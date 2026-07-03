import { describe, it, expect } from "vitest"
import {
  parseRepRangeTop,
  getOverloadSuggestion,
  suggestedIncrement,
} from "./progressive-overload"

describe("parseRepRangeTop", () => {
  it("parses ranges", () => {
    expect(parseRepRangeTop("8-12")).toBe(12)
    expect(parseRepRangeTop("10-12")).toBe(12)
    expect(parseRepRangeTop("12-15")).toBe(15)
  })

  it("parses single numbers", () => {
    expect(parseRepRangeTop("10")).toBe(10)
    expect(parseRepRangeTop("8")).toBe(8)
  })

  it("handles en-dash and whitespace", () => {
    expect(parseRepRangeTop("8 – 12")).toBe(12)
    expect(parseRepRangeTop("  10 - 12  ")).toBe(12)
  })

  it("returns null for non-numeric formats", () => {
    expect(parseRepRangeTop("30 sec")).toBeNull()
    expect(parseRepRangeTop("10 each")).toBeNull()
    expect(parseRepRangeTop("20-30 min")).toBeNull()
    expect(parseRepRangeTop("")).toBeNull()
    expect(parseRepRangeTop(null)).toBeNull()
    expect(parseRepRangeTop(undefined)).toBeNull()
  })
})

describe("getOverloadSuggestion", () => {
  it("suggests +5 lbs when all sets hit top of range at same weight", () => {
    const sets = [
      { weight: 25, reps: 12 },
      { weight: 25, reps: 12 },
      { weight: 25, reps: 12 },
    ]
    const result = getOverloadSuggestion(sets, 12)
    expect(result).toEqual({
      previousWeight: 25,
      suggestedWeight: 30,
      increment: 5,
      repTarget: 12,
    })
  })

  it("counts reps exceeding the top of range as cleared", () => {
    const sets = [
      { weight: 25, reps: 15 },
      { weight: 25, reps: 13 },
      { weight: 25, reps: 12 },
    ]
    expect(getOverloadSuggestion(sets, 12)).not.toBeNull()
  })

  it("returns null when any set misses the rep target", () => {
    const sets = [
      { weight: 25, reps: 12 },
      { weight: 25, reps: 10 },
      { weight: 25, reps: 12 },
    ]
    expect(getOverloadSuggestion(sets, 12)).toBeNull()
  })

  it("returns null when weights vary across sets", () => {
    const sets = [
      { weight: 25, reps: 12 },
      { weight: 30, reps: 12 },
    ]
    expect(getOverloadSuggestion(sets, 12)).toBeNull()
  })

  it("returns null with no previous sets or no rep target", () => {
    expect(getOverloadSuggestion([], 12)).toBeNull()
    expect(getOverloadSuggestion([{ weight: 25, reps: 12 }], null)).toBeNull()
  })

  it("returns null when a set is missing weight or reps", () => {
    expect(
      getOverloadSuggestion(
        [
          { weight: null, reps: 12 },
          { weight: 25, reps: 12 },
        ],
        12
      )
    ).toBeNull()
  })

  it("accepts a custom increment", () => {
    const result = getOverloadSuggestion(
      [
        { weight: 100, reps: 8 },
        { weight: 100, reps: 8 },
      ],
      8,
      10
    )
    expect(result?.suggestedWeight).toBe(110)
    expect(result?.increment).toBe(10)
  })
})

describe("suggestedIncrement", () => {
  it("suggests +10 for lower-body compounds", () => {
    expect(suggestedIncrement(["quads", "hamstrings", "glutes"])).toBe(10) // leg press
    expect(suggestedIncrement(["quads", "glutes"])).toBe(10) // goblet squat
  })

  it("suggests +5 for lower-body isolation", () => {
    expect(suggestedIncrement(["hamstrings"])).toBe(5) // leg curl
    expect(suggestedIncrement(["quads"])).toBe(5) // leg extension
  })

  it("suggests +5 for upper-body compounds", () => {
    expect(suggestedIncrement(["chest", "triceps", "shoulders"])).toBe(5) // chest press
    expect(suggestedIncrement(["back", "biceps"])).toBe(5) // row
  })

  it("suggests +2.5 for isolation / small-muscle work", () => {
    expect(suggestedIncrement(["shoulders"])).toBe(2.5) // lateral raise
    expect(suggestedIncrement(["biceps"])).toBe(2.5) // curl
    expect(suggestedIncrement(["chest"])).toBe(2.5) // fly
    expect(suggestedIncrement(["core"])).toBe(2.5)
  })

  it("ignores the full_body tag and falls back to +5 when nothing remains", () => {
    expect(suggestedIncrement(["full_body"])).toBe(5)
    expect(suggestedIncrement([])).toBe(5)
  })

  it("feeds through getOverloadSuggestion", () => {
    const sets = [
      { weight: 15, reps: 15 },
      { weight: 15, reps: 15 },
    ]
    const result = getOverloadSuggestion(sets, 15, suggestedIncrement(["shoulders"]))
    expect(result?.increment).toBe(2.5)
    expect(result?.suggestedWeight).toBe(17.5)
  })
})
