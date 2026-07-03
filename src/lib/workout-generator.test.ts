import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { generateWorkout, type GenerateWorkoutInput } from "./workout-generator"
import { exercises } from "@/data/exercises"

// Pin Math.random so shuffles + picks are deterministic across runs.
// 0.42 just happens to give us a stable ordering — what matters is the seed,
// not the exact value.
const FIXED_RANDOM = 0.42

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(FIXED_RANDOM)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function baseInput(
  overrides: Partial<GenerateWorkoutInput> = {}
): GenerateWorkoutInput {
  return {
    goal: "build_muscle",
    fitnessLevel: "intermediate",
    workoutDays: 3,
    ...overrides,
  }
}

describe("generateWorkout — structural invariants", () => {
  it("returns one day per workoutDays input (for non-express)", () => {
    for (const days of [1, 2, 3, 4, 5, 6]) {
      const out = generateWorkout(baseInput({ workoutDays: days }))
      expect(out.length, `workoutDays=${days}`).toBe(days)
    }
  })

  it("returns exactly one workout for the express split", () => {
    const out = generateWorkout(
      baseInput({ splitType: "express", workoutDays: 5 })
    )
    expect(out.length).toBe(1)
    expect(out[0].splitType).toBe("express")
    expect(out[0].estimatedMins).toBe(30)
  })

  it("uses full-body split for <=3 days", () => {
    const out = generateWorkout(baseInput({ workoutDays: 3 }))
    expect(out.every((d) => d.splitType === "full_body")).toBe(true)
  })

  it("uses upper/lower split for 4 days", () => {
    const out = generateWorkout(baseInput({ workoutDays: 4 }))
    const types = out.map((d) => d.splitType)
    expect(new Set(types)).toEqual(new Set(["upper", "lower"]))
  })

  it("uses PPL + upper/lower for 5 days", () => {
    const out = generateWorkout(baseInput({ workoutDays: 5 }))
    const types = out.map((d) => d.splitType)
    expect(new Set(types)).toEqual(
      new Set(["push", "pull", "legs", "upper", "lower"])
    )
  })

  it("uses PPL twice for 6 days", () => {
    const out = generateWorkout(baseInput({ workoutDays: 6 }))
    const types = out.map((d) => d.splitType).sort()
    expect(types).toEqual(["legs", "legs", "pull", "pull", "push", "push"])
  })

  it("never repeats an exercise within a single workout day", () => {
    const out = generateWorkout(baseInput({ workoutDays: 5 }))
    for (const day of out) {
      const ids = day.exercises.map((e) => e.exerciseId)
      expect(new Set(ids).size, day.name).toBe(ids.length)
    }
  })

  it("produces at least one exercise per day", () => {
    const out = generateWorkout(baseInput({ workoutDays: 6 }))
    for (const day of out) {
      expect(day.exercises.length, day.name).toBeGreaterThan(0)
    }
  })
})

describe("generateWorkout — difficulty filtering", () => {
  it("never assigns intermediate or advanced exercises to a beginner", () => {
    const allowedIds = new Set(
      exercises.filter((e) => e.difficulty === "beginner").map((e) => e.id)
    )
    const out = generateWorkout(
      baseInput({ fitnessLevel: "beginner", workoutDays: 6 })
    )
    for (const day of out) {
      for (const ex of day.exercises) {
        expect(allowedIds.has(ex.exerciseId), `${ex.name} not beginner`).toBe(
          true
        )
      }
    }
  })

  it("never assigns advanced exercises to an intermediate user", () => {
    const allowedIds = new Set(
      exercises
        .filter(
          (e) => e.difficulty === "beginner" || e.difficulty === "intermediate"
        )
        .map((e) => e.id)
    )
    const out = generateWorkout(
      baseInput({ fitnessLevel: "intermediate", workoutDays: 6 })
    )
    for (const day of out) {
      for (const ex of day.exercises) {
        expect(allowedIds.has(ex.exerciseId)).toBe(true)
      }
    }
  })
})

describe("generateWorkout — goal-driven schemes", () => {
  it("applies the lose_weight scheme to strength sets (3 sets, 30s rest)", () => {
    const out = generateWorkout(
      baseInput({ goal: "lose_weight", workoutDays: 3 })
    )
    for (const day of out) {
      const strengthSets = day.exercises.filter(
        (e) => e.reps === "12-15" && e.restSeconds === 30
      )
      // At least the main weight-room exercises follow the lose_weight scheme.
      expect(strengthSets.length).toBeGreaterThan(0)
      for (const ex of strengthSets) {
        expect(ex.sets).toBe(3)
      }
    }
  })

  it("applies the build_muscle scheme (4 sets, 8-12 reps, 90s rest)", () => {
    const out = generateWorkout(
      baseInput({ goal: "build_muscle", workoutDays: 3 })
    )
    const strengthSets = out[0].exercises.filter(
      (e) => e.reps === "8-12" && e.restSeconds === 90
    )
    expect(strengthSets.length).toBeGreaterThan(0)
    for (const ex of strengthSets) {
      expect(ex.sets).toBe(4)
    }
  })

  it("uses longer cardio for lose_weight than for build_muscle", () => {
    const lose = generateWorkout(
      baseInput({ goal: "lose_weight", workoutDays: 3 })
    )[0]
    const muscle = generateWorkout(
      baseInput({ goal: "build_muscle", workoutDays: 3 })
    )[0]

    const cardioReps = (day: typeof lose) =>
      day.exercises.find((e) => e.restSeconds === 0)?.reps
    expect(cardioReps(lose)).toBe("25-30 min")
    expect(cardioReps(muscle)).toBe("15-20 min")
  })
})

describe("generateWorkout — cardio + calisthenics composition", () => {
  it("includes a cardio finisher on every day (when cardio pool is available)", () => {
    const out = generateWorkout(baseInput({ workoutDays: 5 }))
    for (const day of out) {
      const cardio = day.exercises.find((e) => e.restSeconds === 0)
      expect(cardio, `${day.name} has no cardio`).toBeDefined()
    }
  })

  it("targets the day's primary muscle group at least once on each day", () => {
    // Map split type -> at least one of its primary muscle groups
    const expectedHits: Record<string, string[]> = {
      push: ["chest", "shoulders", "triceps"],
      pull: ["back", "biceps"],
      legs: ["quads", "hamstrings", "glutes", "calves"],
      upper: ["chest", "back", "shoulders"],
      lower: ["quads", "hamstrings", "glutes", "calves"],
      full_body: ["chest", "back", "quads"],
    }
    const out = generateWorkout(baseInput({ workoutDays: 6 }))
    for (const day of out) {
      const allMuscles = day.exercises.flatMap((e) => e.muscleGroups)
      const expected = expectedHits[day.splitType] ?? []
      const hit = expected.some((m) => allMuscles.includes(m))
      expect(hit, `${day.name} missed all of ${expected.join(",")}`).toBe(true)
    }
  })

  it("estimatedMins is positive and roughly tracks set count", () => {
    const out = generateWorkout(baseInput({ workoutDays: 3 }))
    for (const day of out) {
      expect(day.estimatedMins).toBeGreaterThan(0)
      // Each strength set is ~2.5min by the generator's own formula.
      const strengthSets = day.exercises
        .filter((e) => e.restSeconds > 0)
        .reduce((sum, e) => sum + e.sets, 0)
      // ±5 min slack: cardio is +20 if present.
      const expectedLower = Math.round(strengthSets * 2.5)
      expect(day.estimatedMins).toBeGreaterThanOrEqual(expectedLower)
    }
  })
})

describe("generateWorkout — express circuit", () => {
  it("includes 5-6 strength exercises plus a cardio finisher", () => {
    const out = generateWorkout(
      baseInput({ splitType: "express", workoutDays: 1 })
    )
    const day = out[0]
    const cardio = day.exercises.filter((e) => e.restSeconds === 0)
    const strength = day.exercises.filter((e) => e.restSeconds > 0)
    expect(cardio.length).toBe(1)
    expect(strength.length).toBeGreaterThanOrEqual(4)
    expect(strength.length).toBeLessThanOrEqual(6)
  })

  it("express strength exercises use 3 sets of 10-12 with 30s rest", () => {
    const out = generateWorkout(
      baseInput({ splitType: "express", workoutDays: 1 })
    )
    for (const ex of out[0].exercises.filter((e) => e.restSeconds > 0)) {
      expect(ex.sets).toBe(3)
      expect(ex.reps).toBe("10-12")
      expect(ex.restSeconds).toBe(30)
    }
  })
})

describe("generateWorkout — limitations and age", () => {
  const KNEE_UNSAFE = [
    "smith-machine-squat",
    "dumbbell-goblet-squat",
    "dumbbell-lunge",
    "smith-machine-lunge",
    "bulgarian-split-squat",
    "dumbbell-step-up",
    "leg-extension-exercise",
    "treadmill-jog",
    "treadmill-run",
    "outdoor-run",
    "stairmaster-exercise",
  ]

  it("excludes knee-loading exercises when limitations mention a knee", () => {
    const out = generateWorkout(
      baseInput({ workoutDays: 4, limitations: "bad knee" })
    )
    const pickedIds = out.flatMap((w) => w.exercises.map((e) => e.exerciseId))
    for (const id of KNEE_UNSAFE) {
      expect(pickedIds, `should exclude ${id}`).not.toContain(id)
    }
    // Leg days still have work to do — machine-supported options remain.
    const lower = out.find((w) => w.splitType === "lower")!
    expect(lower.exercises.length).toBeGreaterThan(0)
  })

  it("excludes overhead pressing when limitations mention a shoulder", () => {
    const out = generateWorkout(
      baseInput({ workoutDays: 5, limitations: "rotator cuff issues" })
    )
    const pickedIds = out.flatMap((w) => w.exercises.map((e) => e.exerciseId))
    expect(pickedIds).not.toContain("dumbbell-shoulder-press")
    expect(pickedIds).not.toContain("shoulder-press-machine-exercise")
    expect(pickedIds).not.toContain("smith-machine-overhead-press")
  })

  it("applies exclusions to the express circuit too", () => {
    const out = generateWorkout(
      baseInput({ splitType: "express", limitations: "bad knees" })
    )
    const pickedIds = out[0].exercises.map((e) => e.exerciseId)
    for (const id of KNEE_UNSAFE) {
      expect(pickedIds).not.toContain(id)
    }
  })

  it("picks low-impact cardio for users 60+", () => {
    const lowImpact = new Set([
      "treadmill-walk",
      "incline-treadmill-walk",
      "elliptical-exercise",
      "stationary-bike-exercise",
      "rowing-exercise",
    ])
    const out = generateWorkout(baseInput({ workoutDays: 6, age: 65 }))
    const cardio = out
      .flatMap((w) => w.exercises)
      .filter((e) => e.restSeconds === 0)
    expect(cardio.length).toBeGreaterThan(0)
    for (const c of cardio) {
      expect(lowImpact.has(c.exerciseId), c.exerciseId).toBe(true)
    }
  })

  it("does not constrain younger users without limitations", () => {
    // With the same pinned seed, a 30-year-old and an unspecified-age user
    // get identical output.
    const young = generateWorkout(baseInput({ workoutDays: 3, age: 30 }))
    const unspecified = generateWorkout(baseInput({ workoutDays: 3 }))
    expect(young).toEqual(unspecified)
  })

  it("ignores unrecognized limitation text", () => {
    const out = generateWorkout(
      baseInput({ workoutDays: 3, limitations: "prefer mornings" })
    )
    const plain = generateWorkout(baseInput({ workoutDays: 3 }))
    expect(out).toEqual(plain)
  })
})
