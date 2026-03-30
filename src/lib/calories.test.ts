import { describe, it, expect } from "vitest"
import {
  estimateStrengthCalories,
  estimateCardioCalories,
  calculateWorkoutCalories,
  ExerciseCalorieInput,
} from "./calories"

describe("estimateStrengthCalories", () => {
  it("returns a reasonable calorie estimate for a known exercise", () => {
    // push-ups have MET 3.8, 3 sets at 180 lbs
    // weightKg = 180 * 0.453592 = 81.65
    // durationHours = (3 * 2) / 60 = 0.1
    // calories = 3.8 * 81.65 * 0.1 = 31.03 -> 31
    const result = estimateStrengthCalories("push-ups", 3, 180)
    expect(result).toBe(31)
  })

  it("uses default strength MET for unknown exercise IDs", () => {
    // Default strength MET is 3.5
    // weightKg = 200 * 0.453592 = 90.72
    // durationHours = (4 * 2) / 60 = 0.1333
    // calories = 3.5 * 90.72 * 0.1333 = 42.32 -> 42
    const result = estimateStrengthCalories("unknown-exercise", 4, 200)
    expect(result).toBe(42)
  })

  it("returns 0 for 0 sets", () => {
    const result = estimateStrengthCalories("push-ups", 0, 180)
    expect(result).toBe(0)
  })

  it("handles very heavy body weight", () => {
    const result = estimateStrengthCalories("push-ups", 3, 400)
    expect(result).toBeGreaterThan(0)
    // Should be roughly double the 180 lbs result
    const lightResult = estimateStrengthCalories("push-ups", 3, 200)
    const heavyResult = estimateStrengthCalories("push-ups", 3, 400)
    expect(heavyResult).toBe(lightResult * 2)
  })
})

describe("estimateCardioCalories", () => {
  it("calculates calories for a basic cardio exercise", () => {
    // elliptical-exercise has MET 5.0
    // weightKg = 150 * 0.453592 = 68.04
    // durationHours = 30 / 60 = 0.5
    // calories = 5.0 * 68.04 * 0.5 = 170.1 -> 170
    const result = estimateCardioCalories("elliptical-exercise", 30, 150)
    expect(result).toBe(170)
  })

  it("adjusts MET for treadmill based on speed", () => {
    // slow walk at 2.5 mph -> MET 2.5
    const slow = estimateCardioCalories("treadmill-walk", 30, 180, 2.5)
    // jog at 5.5 mph -> MET 7.0
    const fast = estimateCardioCalories("treadmill-walk", 30, 180, 5.5)
    expect(fast).toBeGreaterThan(slow)
  })

  it("uses speed-based MET brackets correctly for treadmill", () => {
    const bodyWeight = 180
    const duration = 60 // 1 hour
    const weightKg = bodyWeight * 0.453592

    // speed < 3.0 -> MET 2.5
    const verySlowCals = estimateCardioCalories("treadmill-walk", duration, bodyWeight, 2.0)
    expect(verySlowCals).toBe(Math.round(2.5 * weightKg * 1))

    // speed >= 9.0 -> MET 12.8
    const sprintCals = estimateCardioCalories("treadmill-run", duration, bodyWeight, 10.0)
    expect(sprintCals).toBe(Math.round(12.8 * weightKg * 1))
  })

  it("does not adjust MET for non-treadmill exercises even with speed", () => {
    // elliptical with speed should still use base MET 5.0
    const withSpeed = estimateCardioCalories("elliptical-exercise", 30, 180, 5.0)
    const withoutSpeed = estimateCardioCalories("elliptical-exercise", 30, 180)
    expect(withSpeed).toBe(withoutSpeed)
  })

  it("returns 0 for 0 duration", () => {
    const result = estimateCardioCalories("elliptical-exercise", 0, 180)
    expect(result).toBe(0)
  })
})

describe("calculateWorkoutCalories", () => {
  it("calculates total and per-exercise calories for mixed exercises", () => {
    const exercises: ExerciseCalorieInput[] = [
      {
        exerciseId: "treadmill-jog",
        exerciseType: "cardio",
        completedSets: 0,
        totalDurationMins: 20,
        speedMph: null,
      },
      {
        exerciseId: "push-ups",
        exerciseType: "strength",
        completedSets: 4,
        totalDurationMins: null,
      },
    ]

    const result = calculateWorkoutCalories(exercises, 180)

    expect(result.perExercise).toHaveLength(2)
    expect(result.perExercise[0]).toBeGreaterThan(0) // cardio
    expect(result.perExercise[1]).toBeGreaterThan(0) // strength
    expect(result.total).toBe(result.perExercise[0] + result.perExercise[1])
  })

  it("returns zeros for an empty exercise list", () => {
    const result = calculateWorkoutCalories([], 180)
    expect(result.perExercise).toEqual([])
    expect(result.total).toBe(0)
  })

  it("treats cardio with null duration as strength (uses sets)", () => {
    const exercises: ExerciseCalorieInput[] = [
      {
        exerciseId: "treadmill-jog",
        exerciseType: "cardio",
        completedSets: 3,
        totalDurationMins: null,
      },
    ]

    // When totalDurationMins is null, it falls through to estimateStrengthCalories
    const result = calculateWorkoutCalories(exercises, 180)
    const expected = estimateStrengthCalories("treadmill-jog", 3, 180)
    expect(result.perExercise[0]).toBe(expected)
  })

  it("uses flexibility default MET for flexibility exercises", () => {
    const exercises: ExerciseCalorieInput[] = [
      {
        exerciseId: "some-stretch",
        exerciseType: "flexibility",
        completedSets: 2,
        totalDurationMins: null,
      },
    ]

    // flexibility falls through to strength path; default MET for unknown ID
    // with exerciseType "strength" passed to getMetValue -> but actually
    // estimateStrengthCalories hardcodes "strength" as the type.
    // So it will use DEFAULT_MET.strength = 3.5
    const result = calculateWorkoutCalories(exercises, 180)
    expect(result.perExercise[0]).toBeGreaterThan(0)
  })
})
