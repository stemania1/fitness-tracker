import { describe, it, expect } from "vitest"
import { adaptiveTarget } from "./adaptive-target"
import type { PreviousSet } from "./progressive-overload"

const sets = (...pairs: [number, number][]): PreviousSet[] =>
  pairs.map(([weight, reps]) => ({ weight, reps }))

describe("adaptiveTarget", () => {
  it("progresses when every set cleared the top of the range", () => {
    // 3×12 at 100, range 8-12 → +5.
    const t = adaptiveTarget({
      previousSets: sets([100, 12], [100, 12], [100, 12]),
      repRange: "8-12",
      increment: 5,
    })
    expect(t.reason).toBe("progress")
    expect(t.weight).toBe(105)
    expect(t.label).toMatch(/\+5 lb/)
  })

  it("repeats when the last session landed inside the range", () => {
    const t = adaptiveTarget({
      previousSets: sets([100, 10], [100, 9], [100, 10]),
      repRange: "8-12",
      increment: 5,
    })
    expect(t.reason).toBe("repeat")
    expect(t.weight).toBe(100)
  })

  it("holds when any set fell short of the bottom of the range", () => {
    const t = adaptiveTarget({
      previousSets: sets([100, 10], [100, 6], [100, 5]),
      repRange: "8-12",
      increment: 5,
    })
    expect(t.reason).toBe("hold")
    expect(t.weight).toBe(100)
    expect(t.note).toMatch(/short/i)
  })

  it("uses the lightest working weight so one heavy set can't inflate the target", () => {
    const t = adaptiveTarget({
      previousSets: sets([110, 8], [100, 10], [100, 9]),
      repRange: "8-12",
      increment: 5,
    })
    // Mixed weights → not a clean progression; hold/repeat at the sustained 100.
    expect(t.weight).toBe(100)
    expect(t.reason).toBe("repeat")
  })

  it("falls back to the plan weight with reason 'new' when there's no history", () => {
    const t = adaptiveTarget({
      previousSets: [],
      repRange: "8-12",
      increment: 5,
      fallbackWeight: 60,
    })
    expect(t.reason).toBe("new")
    expect(t.weight).toBe(60)
  })

  it("ignores sets with missing weight/reps", () => {
    const t = adaptiveTarget({
      previousSets: [
        { weight: null, reps: 12 },
        { weight: 80, reps: null },
      ],
      repRange: "8-12",
      increment: 5,
      fallbackWeight: 75,
    })
    expect(t.reason).toBe("new")
    expect(t.weight).toBe(75)
  })

  it("assisted: progress DROPS assistance when you clear the top of the range", () => {
    // 3×8 at 150 lb assist, range 6-8 → drop to 145 (less help).
    const t = adaptiveTarget({
      previousSets: sets([150, 8], [150, 8], [150, 8]),
      repRange: "6-8",
      increment: 5,
      assisted: true,
    })
    expect(t.reason).toBe("progress")
    expect(t.weight).toBe(145)
    expect(t.label).toMatch(/−5 lb assist/)
  })

  it("assisted: holds the most-assistance level when you fall short", () => {
    // Mixed assistance; worst set 5 reps (< bottom 6). Keep the most help (150).
    const t = adaptiveTarget({
      previousSets: sets([100, 8], [130, 7], [150, 5]),
      repRange: "6-8",
      increment: 5,
      assisted: true,
    })
    expect(t.reason).toBe("hold")
    expect(t.weight).toBe(150)
  })

  it("assisted: never drops assistance below zero", () => {
    const t = adaptiveTarget({
      previousSets: sets([3, 8], [3, 8]),
      repRange: "6-8",
      increment: 5,
      assisted: true,
    })
    expect(t.reason).toBe("progress")
    expect(t.weight).toBe(0)
  })

  it("repeats (not progress) when there's no usable rep range", () => {
    const t = adaptiveTarget({
      previousSets: sets([50, 30], [50, 30]),
      repRange: "30 sec",
      increment: 5,
    })
    expect(t.reason).toBe("repeat")
    expect(t.weight).toBe(50)
  })
})
