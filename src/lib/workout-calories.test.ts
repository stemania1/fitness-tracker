import { describe, it, expect } from "vitest"
import { exerciseCalories, workoutCalories } from "./workout-calories"
import { makeSet, type ActiveExercise, type ActiveSet } from "./active-workout"

const WEIGHT = 180

function set(over: Partial<ActiveSet> = {}): ActiveSet {
  return { ...makeSet(), ...over }
}

function strength(sets: ActiveSet[]): ActiveExercise {
  return {
    exerciseId: "bench-press",
    name: "Bench Press",
    muscleGroups: ["chest"],
    exerciseType: "strength",
    assisted: false,
    equipmentId: "barbell",
    repsTarget: "8-12",
    sets,
    notes: "",
    restSeconds: 90,
  }
}

function treadmill(sets: ActiveSet[]): ActiveExercise {
  return {
    ...strength(sets),
    exerciseId: "treadmill-walk",
    name: "Treadmill",
    exerciseType: "cardio",
    equipmentId: "treadmill",
  }
}

describe("exerciseCalories", () => {
  // A set typed in but not checked off hasn't been done yet.
  it("counts only completed sets", () => {
    const done = exerciseCalories(
      strength([set({ completed: true }), set({ completed: true })]),
      WEIGHT,
      {}
    )
    const partial = exerciseCalories(
      strength([set({ completed: true }), set({ completed: false })]),
      WEIGHT,
      {}
    )
    expect(done).toBeGreaterThan(partial)
    expect(partial).toBeGreaterThan(0)
  })

  it("is zero when nothing is completed", () => {
    expect(exerciseCalories(strength([set(), set()]), WEIGHT, {})).toBe(0)
  })

  it("sums duration across completed cardio sets", () => {
    const one = exerciseCalories(
      treadmill([set({ completed: true, durationMins: 10, distanceMiles: 1 })]),
      WEIGHT,
      {}
    )
    const two = exerciseCalories(
      treadmill([
        set({ completed: true, durationMins: 10, distanceMiles: 1 }),
        set({ completed: true, durationMins: 10, distanceMiles: 1 }),
      ]),
      WEIGHT,
      {}
    )
    expect(two).toBeGreaterThan(one)
  })

  // Distance cardio derives speed; a faster mile in the same time must not
  // read as the same effort.
  it("derives speed from distance for distance-based cardio", () => {
    const slow = exerciseCalories(
      treadmill([set({ completed: true, durationMins: 30, distanceMiles: 1.5 })]),
      WEIGHT,
      {}
    )
    const fast = exerciseCalories(
      treadmill([set({ completed: true, durationMins: 30, distanceMiles: 4 })]),
      WEIGHT,
      {}
    )
    expect(fast).toBeGreaterThan(slow)
  })

  // Sets logged without an incline must not average it toward zero.
  it("ignores missing and zero inclines when averaging", () => {
    const withGaps = exerciseCalories(
      treadmill([
        set({ completed: true, durationMins: 15, distanceMiles: 1, inclinePercent: 10 }),
        set({ completed: true, durationMins: 15, distanceMiles: 1, inclinePercent: null }),
        set({ completed: true, durationMins: 15, distanceMiles: 1, inclinePercent: 0 }),
      ]),
      WEIGHT,
      {}
    )
    const allTen = exerciseCalories(
      treadmill([
        set({ completed: true, durationMins: 15, distanceMiles: 1, inclinePercent: 10 }),
        set({ completed: true, durationMins: 15, distanceMiles: 1, inclinePercent: 10 }),
        set({ completed: true, durationMins: 15, distanceMiles: 1, inclinePercent: 10 }),
      ]),
      WEIGHT,
      {}
    )
    expect(withGaps).toBe(allTen)
  })

  it("scales with body weight", () => {
    const light = exerciseCalories(strength([set({ completed: true })]), 130, {})
    const heavy = exerciseCalories(strength([set({ completed: true })]), 260, {})
    expect(heavy).toBeGreaterThan(light)
  })
})

describe("workoutCalories", () => {
  it("sums across exercises", () => {
    const ex = strength([set({ completed: true })])
    const total = workoutCalories(
      { name: "W", templateId: null, startedAt: new Date(), exercises: [ex, ex] },
      WEIGHT,
      {}
    )
    expect(total).toBe(exerciseCalories(ex, WEIGHT, {}) * 2)
  })

  // The page renders this before init() has set the workout.
  it("is zero for a workout that hasn't loaded", () => {
    expect(workoutCalories(null, WEIGHT, {})).toBe(0)
  })

  it("is zero for a workout with no exercises", () => {
    expect(
      workoutCalories(
        { name: "W", templateId: null, startedAt: new Date(), exercises: [] },
        WEIGHT,
        {}
      )
    ).toBe(0)
  })
})
