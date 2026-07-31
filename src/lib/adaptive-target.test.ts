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

// Bodyweight moves (pull-up, push-up) have no weight input in the logger, so
// any logged "weight" is the user's own bodyweight, not load. Weight-based
// advice there is unfollowable.
describe("adaptiveTarget — bodyweight moves", () => {
  const bw = { increment: 5, bodyweight: true as const }

  it("never suggests a weight", () => {
    const t = adaptiveTarget({
      ...bw,
      previousSets: [
        { weight: 230, reps: 1 },
        { weight: 230, reps: 1 },
      ],
      repRange: "8",
    })
    expect(t.weight).toBeNull()
  })

  it("holds on reps, without mentioning load, when short of the range", () => {
    const t = adaptiveTarget({
      ...bw,
      previousSets: [
        { weight: 230, reps: 1 },
        { weight: 230, reps: 1 },
        { weight: 230, reps: 1 },
      ],
      repRange: "8",
    })
    expect(t.reason).toBe("hold")
    expect(t.label).toBe("Build reps")
    expect(t.note).toContain("1 rep")
    expect(t.note).not.toMatch(/lb|weight/i)
  })

  it("pluralises the rep count", () => {
    const t = adaptiveTarget({
      ...bw,
      previousSets: [{ weight: null, reps: 3 }],
      repRange: "8",
    })
    expect(t.note).toContain("3 reps")
  })

  it("suggests adding reps once the top of the range is cleared", () => {
    const t = adaptiveTarget({
      ...bw,
      previousSets: [
        { weight: null, reps: 10 },
        { weight: null, reps: 9 },
      ],
      repRange: "5-8",
    })
    expect(t.reason).toBe("progress")
    expect(t.note).not.toMatch(/lb\b/i)
  })

  it("repeats when working inside the range", () => {
    const t = adaptiveTarget({
      ...bw,
      previousSets: [{ weight: null, reps: 6 }],
      repRange: "5-8",
    })
    expect(t.reason).toBe("repeat")
    expect(t.note).toContain("8 reps")
  })

  // With no weight logged at all, the load path would have found nothing
  // usable and hidden the banner; the rep path still has something to say.
  it("works from reps alone, with no weight ever logged", () => {
    const t = adaptiveTarget({
      ...bw,
      previousSets: [{ weight: null, reps: 2 }],
      repRange: "8",
    })
    expect(t.reason).toBe("hold")
  })

  it("falls back to New with no usable history", () => {
    const t = adaptiveTarget({ ...bw, previousSets: [], repRange: "8" })
    expect(t.reason).toBe("new")
  })
})
