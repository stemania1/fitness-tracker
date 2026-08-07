import { describe, it, expect } from "vitest"
import { prefillWeight, applyPrefill } from "./workout-prefill"
import {
  makeSet,
  type ActiveExercise,
  type ActiveWorkout,
} from "./active-workout"

function exercise(overrides: Partial<ActiveExercise> = {}): ActiveExercise {
  return {
    exerciseId: "chest-press-machine-flat",
    name: "Chest Press Machine",
    muscleGroups: ["chest"],
    exerciseType: "strength",
    assisted: false,
    equipmentId: "chest-press-machine",
    repsTarget: "8-12",
    sets: [makeSet(), makeSet(), makeSet()],
    notes: "",
    restSeconds: 60,
    ...overrides,
  }
}

const prevSets = [
  { weight: 100, reps: 12 },
  { weight: 100, reps: 12 },
  { weight: 100, reps: 12 },
]

describe("prefillWeight", () => {
  it("returns the adaptive target weight for an untouched strength exercise", () => {
    // Last session cleared the top of the range on all sets → progress.
    const w = prefillWeight(exercise(), prevSets)
    expect(w).not.toBeNull()
    expect(w!).toBeGreaterThanOrEqual(100)
  })

  it("returns null for cardio", () => {
    expect(
      prefillWeight(exercise({ exerciseType: "cardio" }), prevSets)
    ).toBeNull()
  })

  it("returns null with no previous session", () => {
    expect(prefillWeight(exercise(), [])).toBeNull()
  })

  it("returns null once any set has been touched", () => {
    const typed = exercise()
    typed.sets[1] = { ...makeSet(), weight: 95 }
    expect(prefillWeight(typed, prevSets)).toBeNull()

    const completed = exercise()
    completed.sets[0] = { ...makeSet(), completed: true }
    expect(prefillWeight(completed, prevSets)).toBeNull()
  })
})

describe("applyPrefill", () => {
  const workout: ActiveWorkout = {
    name: "Test",
    templateId: null,
    startedAt: new Date("2026-08-07T10:00:00Z"),
    exercises: [exercise()],
  }

  it("writes the weight into every set, leaving reps and completion alone", () => {
    const next = applyPrefill(workout, "chest-press-machine-flat", 105)
    expect(next.exercises[0].sets.every((s) => s.weight === 105)).toBe(true)
    expect(next.exercises[0].sets.every((s) => s.reps === null)).toBe(true)
    expect(next.exercises[0].sets.every((s) => !s.completed)).toBe(true)
    // Original untouched (immutability).
    expect(workout.exercises[0].sets[0].weight).toBeNull()
  })

  it("returns the workout unchanged for an unknown exercise", () => {
    expect(applyPrefill(workout, "nope", 105)).toBe(workout)
  })
})
