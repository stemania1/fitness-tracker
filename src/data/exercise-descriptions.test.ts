import { describe, it, expect } from "vitest"
import { exercises } from "./exercises"
import { exerciseDescription } from "./exercise-descriptions"

describe("exercise descriptions", () => {
  it("has a description for every catalog exercise", () => {
    const missing = exercises
      .filter((e) => !exerciseDescription(e.id))
      .map((e) => e.id)
    expect(missing).toEqual([])
  })

  it("returns null for an unknown id", () => {
    expect(exerciseDescription("not-a-real-exercise")).toBeNull()
  })
})
