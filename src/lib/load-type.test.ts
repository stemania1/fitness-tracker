import { describe, it, expect } from "vitest"
import { exercises } from "@/data/exercises"
import { resolveLoadType, isBodyweightLoad, isAssistedLoad } from "./load-type"

const base = { equipmentId: "dumbbells", assisted: false, exerciseType: "strength" as const }

describe("resolveLoadType", () => {
  it("treats an exercise with equipment as loaded", () => {
    expect(resolveLoadType(base)).toBe("loaded")
  })

  it("treats a strength move with no equipment as bodyweight", () => {
    expect(resolveLoadType({ ...base, equipmentId: null })).toBe("bodyweight")
  })

  it("treats an assisted machine as assistance, not load", () => {
    expect(
      resolveLoadType({ ...base, equipmentId: "assisted-pull-up-dip", assisted: true })
    ).toBe("assisted")
  })

  // Assistance wins: the machine has equipment, but its "weight" is help.
  it("prefers assisted over loaded", () => {
    expect(isAssistedLoad({ ...base, assisted: true })).toBe(true)
    expect(isBodyweightLoad({ ...base, assisted: true })).toBe(false)
  })

  it("does not call cardio or stretching bodyweight", () => {
    expect(
      resolveLoadType({ ...base, equipmentId: null, exerciseType: "cardio" })
    ).toBe("loaded")
    expect(
      resolveLoadType({ ...base, equipmentId: null, exerciseType: "flexibility" })
    ).toBe("loaded")
  })

  // The escape hatch for anything equipment can't express, e.g. a weighted
  // pull-up: a bodyweight movement that still carries load.
  it("lets an explicit loadType override the derivation", () => {
    expect(resolveLoadType({ ...base, equipmentId: null, loadType: "loaded" })).toBe(
      "loaded"
    )
    expect(resolveLoadType({ ...base, loadType: "bodyweight" })).toBe("bodyweight")
    expect(resolveLoadType({ ...base, assisted: true, loadType: "loaded" })).toBe(
      "loaded"
    )
  })
})

describe("catalog classification", () => {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const load = (id: string) => resolveLoadType(byId.get(id)!)

  it("classifies the real exercises that caused bugs", () => {
    // Weight-based progression advice was unusable on this one.
    expect(load("pull-up")).toBe("bodyweight")
    expect(load("push-ups")).toBe("bodyweight")
    expect(load("plank")).toBe("bodyweight")
    // A farmer hold is timed AND loaded — the weight input must stay.
    expect(load("dumbbell-shrug")).toBe("loaded")
    expect(load("assisted-pull-up")).toBe("assisted")
  })

  it("classifies every strength exercise", () => {
    const strength = exercises.filter((e) => e.exerciseType === "strength")
    expect(strength.length).toBeGreaterThan(0)
    for (const e of strength) {
      expect(["loaded", "bodyweight", "assisted"]).toContain(resolveLoadType(e))
    }
  })
})
