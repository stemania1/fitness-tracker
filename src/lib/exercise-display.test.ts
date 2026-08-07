import { describe, it, expect } from "vitest"
import { exerciseDisplay } from "./exercise-display"
import { makeExercise } from "./active-workout"
import { exercises as catalog } from "@/data/exercises"

function fromCatalog(pred: (e: (typeof catalog)[number]) => boolean) {
  const def = catalog.find(pred)
  if (!def) throw new Error("no catalog match")
  return makeExercise(def)
}

describe("exerciseDisplay", () => {
  it("classifies a machine strength exercise", () => {
    const d = exerciseDisplay(
      fromCatalog((e) => e.exerciseType === "strength" && !!e.equipmentId)
    )
    expect(d.isCardio).toBe(false)
    expect(d.isBodyweight).toBe(false)
    expect(d.holdTargetSeconds).toBeNull()
    expect(d.setGridCols).toBe("grid-cols-[2.5rem_1fr_1fr_3rem]")
  })

  it("classifies treadmill cardio with the distance columns", () => {
    const d = exerciseDisplay(fromCatalog((e) => e.id.includes("treadmill")))
    expect(d.isCardio).toBe(true)
    expect(d.isTreadmill).toBe(true)
    expect(d.isDistanceCardio).toBe(true)
    expect(d.setGridCols).toBe("grid-cols-[2.5rem_1fr_1fr_3.5rem_3rem]")
  })

  it("parses the hold target's upper bound from a timed target", () => {
    const plank = fromCatalog((e) => /plank/i.test(e.name))
    plank.repsTarget = "20-30 sec"
    const d = exerciseDisplay(plank)
    expect(d.isTimedHold).toBe(true)
    expect(d.holdTargetSeconds).toBe(30)
  })

  it("returns safe defaults for no exercise", () => {
    const d = exerciseDisplay(undefined)
    expect(d.isCardio).toBe(false)
    expect(d.isTimedHold).toBe(false)
    expect(d.isBodyweight).toBe(false)
    expect(d.holdTargetSeconds).toBeNull()
    expect(d.setGridCols).toBe("grid-cols-[2.5rem_1fr_1fr_3rem]")
  })
})
