import { describe, it, expect } from "vitest"
import { TRAINING_PLAN_PRESETS } from "./template-presets"
import { exercises } from "./exercises"

describe("training plan template presets", () => {
  const catalogIds = new Set(exercises.map((e) => e.id))

  it("only references exercises that exist in the static catalog", () => {
    for (const preset of TRAINING_PLAN_PRESETS) {
      for (const ex of preset.exercises) {
        expect(catalogIds, `${preset.name}: ${ex.exerciseId}`).toContain(
          ex.exerciseId
        )
      }
    }
  })

  it("has unique preset names and sane prescriptions", () => {
    const names = TRAINING_PLAN_PRESETS.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)

    for (const preset of TRAINING_PLAN_PRESETS) {
      expect(preset.exercises.length).toBeGreaterThan(0)
      for (const ex of preset.exercises) {
        expect(ex.sets).toBeGreaterThan(0)
        expect(ex.reps.length).toBeGreaterThan(0)
        expect(ex.restSeconds).toBeGreaterThan(0)
      }
    }
  })
})
