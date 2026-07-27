import { describe, it, expect } from "vitest"
import { analyzeMuscleBalance, type MuscleSet } from "./muscle-balance"

/** `n` identical sets working `groups` at `volume` each. */
function sets(groups: string[], volume: number, n: number): MuscleSet[] {
  return Array.from({ length: n }, () => ({ muscleGroups: groups, volume }))
}

/** A balanced-ish baseline with enough sets to clear the MIN_SETS gate. */
function balanced(): MuscleSet[] {
  return [
    ...sets(["chest"], 100, 2),
    ...sets(["shoulders"], 100, 1),
    ...sets(["triceps"], 100, 1),
    ...sets(["back"], 100, 2),
    ...sets(["biceps"], 100, 1),
    ...sets(["lats"], 100, 1),
    ...sets(["quads"], 100, 2),
    ...sets(["hamstrings"], 100, 1),
    ...sets(["glutes"], 100, 1),
    ...sets(["calves"], 100, 1),
    ...sets(["core"], 100, 1),
  ]
}

describe("analyzeMuscleBalance — volume shares", () => {
  it("splits a compound set's volume evenly so shares sum to ~100", () => {
    const b = analyzeMuscleBalance([
      { muscleGroups: ["chest", "triceps"], volume: 100 },
    ])
    expect(b.groups).toHaveLength(2)
    expect(b.groups[0].volume).toBe(50)
    expect(b.groups[1].volume).toBe(50)
    expect(b.totalVolume).toBe(100)
    const shareSum = b.groups.reduce((s, g) => s + g.sharePct, 0)
    expect(shareSum).toBe(100)
  })

  it("ranks groups by volume, most-worked first", () => {
    const b = analyzeMuscleBalance([
      { muscleGroups: ["chest"], volume: 300 },
      { muscleGroups: ["back"], volume: 100 },
    ])
    expect(b.groups.map((g) => g.group)).toEqual(["chest", "back"])
    expect(b.groups[0].sharePct).toBe(75)
  })

  it("labels groups for display", () => {
    const b = analyzeMuscleBalance([{ muscleGroups: ["quads"], volume: 10 }])
    expect(b.groups[0].label).toBe("Quads")
  })

  it("ignores full_body, empty groups, and non-positive volume", () => {
    const b = analyzeMuscleBalance([
      { muscleGroups: ["full_body"], volume: 500 },
      { muscleGroups: [], volume: 500 },
      { muscleGroups: ["chest"], volume: 0 },
      { muscleGroups: ["chest"], volume: 100 },
    ])
    expect(b.setCount).toBe(1)
    expect(b.totalVolume).toBe(100)
    expect(b.groups.map((g) => g.group)).toEqual(["chest"])
  })

  it("handles no sets at all", () => {
    const b = analyzeMuscleBalance([])
    expect(b.groups).toEqual([])
    expect(b.ratios).toEqual([])
    expect(b.neglected).toEqual([])
    expect(b.totalVolume).toBe(0)
  })
})

describe("analyzeMuscleBalance — ratios", () => {
  it("stays quiet until there's enough logged work", () => {
    const b = analyzeMuscleBalance(sets(["chest"], 100, 3))
    expect(b.setCount).toBe(3)
    expect(b.ratios).toEqual([])
    expect(b.neglected).toEqual([])
  })

  it("calls a proportionate program balanced", () => {
    const b = analyzeMuscleBalance(balanced())
    const pushPull = b.ratios.find((r) => r.key === "push_pull")!
    expect(pushPull.verdict).toBe("balanced")
    expect(pushPull.ratio).toBe(1)
  })

  it("flags pressing outpacing pulling", () => {
    const b = analyzeMuscleBalance([
      ...sets(["chest"], 100, 6),
      ...sets(["back"], 100, 1),
      ...sets(["quads"], 100, 3),
    ])
    const pushPull = b.ratios.find((r) => r.key === "push_pull")!
    expect(pushPull.verdict).toBe("skewed")
    expect(pushPull.ratio).toBeGreaterThan(1.5)
    expect(pushPull.message).toMatch(/add rows or pulldowns/i)
  })

  it("flags pulling outpacing pressing", () => {
    const b = analyzeMuscleBalance([
      ...sets(["back"], 100, 6),
      ...sets(["chest"], 100, 1),
      ...sets(["quads"], 100, 3),
    ])
    const pushPull = b.ratios.find((r) => r.key === "push_pull")!
    expect(pushPull.verdict).toBe("skewed")
    expect(pushPull.message).toMatch(/add a press/i)
  })

  it("flags upper body well ahead of legs", () => {
    const b = analyzeMuscleBalance([
      ...sets(["chest"], 100, 4),
      ...sets(["back"], 100, 4),
      ...sets(["quads"], 100, 1),
    ])
    const upperLower = b.ratios.find((r) => r.key === "upper_lower")!
    expect(upperLower.verdict).toBe("skewed")
    expect(upperLower.message).toMatch(/squat or hinge/i)
  })

  it("reports insufficient when one side has no volume at all", () => {
    const b = analyzeMuscleBalance([
      ...sets(["chest"], 100, 5),
      ...sets(["quads"], 100, 5),
    ])
    const pushPull = b.ratios.find((r) => r.key === "push_pull")!
    expect(pushPull.verdict).toBe("insufficient")
    expect(pushPull.ratio).toBeNull()
    expect(pushPull.message).toMatch(/No pull volume/i)
  })
})

describe("analyzeMuscleBalance — neglected groups", () => {
  it("flags groups with little or no volume", () => {
    const b = analyzeMuscleBalance([
      ...sets(["chest"], 100, 5),
      ...sets(["back"], 100, 5),
    ])
    // Legs and core never trained.
    expect(b.neglected).toEqual(
      expect.arrayContaining(["quads", "hamstrings", "glutes", "calves", "core"])
    )
    // Well-trained groups aren't flagged.
    expect(b.neglected).not.toContain("chest")
    expect(b.neglected).not.toContain("back")
  })

  it("orders the most-neglected first", () => {
    const b = analyzeMuscleBalance([
      ...sets(["chest"], 1000, 5),
      ...sets(["back"], 1000, 5),
      // A sliver of calf work — still under the threshold but above zero.
      { muscleGroups: ["calves"], volume: 10 },
    ])
    // Zero-volume groups sort ahead of the sliver.
    expect(b.neglected.indexOf("calves")).toBeGreaterThan(0)
  })

  it("flags nothing when every group gets a fair share", () => {
    const b = analyzeMuscleBalance(balanced())
    expect(b.neglected).toEqual([])
  })
})
