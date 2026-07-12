import { describe, it, expect } from "vitest"
import { exercises } from "./exercises"
import { equipment } from "./equipment"
import {
  MUSCLE_GROUPS,
  EXERCISE_TYPES,
  EQUIPMENT_CATEGORIES,
} from "@/lib/constants"

const FITNESS_LEVELS = ["beginner", "intermediate", "advanced"] as const

describe("exercises catalog", () => {
  it("has at least one exercise", () => {
    expect(exercises.length).toBeGreaterThan(0)
  })

  it("has unique ids", () => {
    const ids = exercises.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("has unique names", () => {
    const names = exercises.map((e) => e.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("every muscle group is in the canonical MUSCLE_GROUPS enum", () => {
    const valid = new Set<string>(MUSCLE_GROUPS)
    for (const ex of exercises) {
      expect(ex.muscleGroups.length).toBeGreaterThan(0)
      for (const mg of ex.muscleGroups) {
        expect(valid.has(mg), `${ex.id} has unknown muscle group "${mg}"`).toBe(
          true
        )
      }
    }
  })

  it("every difficulty is a known fitness level", () => {
    const valid = new Set<string>(FITNESS_LEVELS)
    for (const ex of exercises) {
      expect(valid.has(ex.difficulty), `${ex.id}: ${ex.difficulty}`).toBe(true)
    }
  })

  it("every exerciseType is in the EXERCISE_TYPES enum", () => {
    const valid = new Set<string>(EXERCISE_TYPES.map((t) => t.value))
    for (const ex of exercises) {
      expect(valid.has(ex.exerciseType), `${ex.id}: ${ex.exerciseType}`).toBe(
        true
      )
    }
  })

  it("every equipmentId resolves to a real equipment item (or null)", () => {
    const equipmentIds = new Set(equipment.map((e) => e.id))
    for (const ex of exercises) {
      if (ex.equipmentId == null) continue
      expect(
        equipmentIds.has(ex.equipmentId),
        `${ex.id} references unknown equipment "${ex.equipmentId}"`
      ).toBe(true)
    }
  })

  it("defaultSets is positive and defaultReps is non-empty", () => {
    for (const ex of exercises) {
      expect(ex.defaultSets, ex.id).toBeGreaterThan(0)
      expect(ex.defaultReps.trim().length, ex.id).toBeGreaterThan(0)
    }
  })

  it("contains the calisthenics ids referenced by the workout generator", () => {
    // workout-generator.ts hardcodes these as the bodyweight pool — if any
    // get renamed without updating the generator, generated workouts silently
    // lose their calisthenics finisher.
    const required = [
      "push-ups",
      "plank",
      "mountain-climbers",
      "bicycle-crunches",
      "dead-bug",
    ]
    const ids = new Set(exercises.map((e) => e.id))
    for (const id of required) {
      expect(ids.has(id), `missing required calisthenics id "${id}"`).toBe(true)
    }
  })

  it("contains at least one strength exercise per non-fullbody muscle group", () => {
    // The workout generator filters by muscleGroups; if a group has no
    // strength exercises the generator will silently produce a short day.
    const skip = new Set(["full_body"])
    for (const mg of MUSCLE_GROUPS) {
      if (skip.has(mg)) continue
      const hits = exercises.filter(
        (e) => e.exerciseType === "strength" && e.muscleGroups.includes(mg)
      )
      expect(hits.length, `no strength exercise targets "${mg}"`).toBeGreaterThan(0)
    }
  })

  it("contains at least one beginner-level strength exercise per muscle group", () => {
    // Beginner users need a workout too: every targetable group must have
    // an exercise at the beginner difficulty.
    const skip = new Set(["full_body"])
    for (const mg of MUSCLE_GROUPS) {
      if (skip.has(mg)) continue
      const hits = exercises.filter(
        (e) =>
          e.exerciseType === "strength" &&
          e.difficulty === "beginner" &&
          e.muscleGroups.includes(mg)
      )
      expect(
        hits.length,
        `no BEGINNER strength exercise targets "${mg}"`
      ).toBeGreaterThan(0)
    }
  })

  it("has timed calf stretches for post-cardio tightness", () => {
    // Flexibility entries the picker surfaces under the Calves chip; all
    // are timed holds so the logger labels the reps column in seconds.
    const stretches = exercises.filter((e) => e.exerciseType === "flexibility")
    expect(stretches.length).toBeGreaterThanOrEqual(3)
    for (const s of stretches) {
      expect(s.muscleGroups, s.id).toContain("calves")
      expect(s.defaultReps, s.id).toMatch(/\bsec\b/)
    }
  })

  it("has at least one beginner cardio option", () => {
    const beginnerCardio = exercises.filter(
      (e) => e.exerciseType === "cardio" && e.difficulty === "beginner"
    )
    expect(beginnerCardio.length).toBeGreaterThan(0)
  })
})

describe("equipment catalog", () => {
  it("has unique ids", () => {
    const ids = equipment.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every category is in the EQUIPMENT_CATEGORIES enum", () => {
    const valid = new Set<string>(EQUIPMENT_CATEGORIES.map((c) => c.value))
    for (const eq of equipment) {
      expect(valid.has(eq.category), `${eq.id}: ${eq.category}`).toBe(true)
    }
  })

  it("every muscle group on equipment is in the canonical enum", () => {
    const valid = new Set<string>(MUSCLE_GROUPS)
    for (const eq of equipment) {
      for (const mg of eq.muscleGroups) {
        expect(valid.has(mg), `${eq.id} has unknown muscle group "${mg}"`).toBe(
          true
        )
      }
    }
  })
})
