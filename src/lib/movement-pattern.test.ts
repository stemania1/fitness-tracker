import { describe, it, expect } from "vitest"
import { exercises } from "@/data/exercises"
import { movementPattern, isStaticHold } from "./movement-pattern"

describe("movementPattern", () => {
  it("groups lifts by what the body does, not the equipment", () => {
    // Same shape, three different loads.
    expect(movementPattern("smith-machine-squat")).toBe("squat")
    expect(movementPattern("dumbbell-goblet-squat")).toBe("squat")
    expect(movementPattern("leg-press-exercise")).toBe("squat")
  })

  it("separates vertical from horizontal pulling", () => {
    expect(movementPattern("pull-up")).toBe("vertical-pull")
    expect(movementPattern("lat-pulldown-exercise")).toBe("vertical-pull")
    expect(movementPattern("dumbbell-row")).toBe("horizontal-pull")
    expect(movementPattern("cable-row")).toBe("horizontal-pull")
  })

  it("separates pressing planes", () => {
    expect(movementPattern("dumbbell-bench-press")).toBe("horizontal-press")
    expect(movementPattern("dumbbell-shoulder-press")).toBe("overhead-press")
  })

  it("returns null where a two-position diagram says nothing", () => {
    expect(movementPattern("treadmill-run")).toBeNull()
    expect(movementPattern("stationary-bike-exercise")).toBeNull()
    expect(movementPattern("foam-roll-calves")).toBeNull()
    expect(movementPattern("standing-calf-stretch")).toBeNull()
  })

  it("returns null for an unknown exercise rather than throwing", () => {
    expect(movementPattern("no-such-exercise")).toBeNull()
  })

  it("marks the plank as a static hold", () => {
    expect(isStaticHold("hold")).toBe(true)
    expect(isStaticHold("squat")).toBe(false)
  })

  // Guards against a new strength exercise silently getting no diagram.
  it("covers every strength exercise in the catalog", () => {
    const uncovered = exercises
      .filter((e) => e.exerciseType === "strength")
      .filter((e) => movementPattern(e.id) === null)
      .map((e) => e.id)
    expect(uncovered).toEqual([])
  })
})
