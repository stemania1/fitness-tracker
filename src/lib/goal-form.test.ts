import { describe, it, expect } from "vitest"
import {
  buildGoalInsert,
  initialGoalFormState,
  unitForGoalType,
} from "./goal-form"
import { ENDURANCE_DISTANCE_UNIT } from "./goal-progress"

describe("unitForGoalType", () => {
  it("maps each goal type to its unit", () => {
    expect(unitForGoalType("weight")).toBe("lbs")
    expect(unitForGoalType("strength")).toBe("lbs")
    expect(unitForGoalType("endurance")).toBe("mins")
    expect(unitForGoalType("consistency")).toBe("workouts/week")
  })

  it("uses the distance unit for a distance-endurance goal", () => {
    expect(unitForGoalType("endurance", "distance")).toBe(
      ENDURANCE_DISTANCE_UNIT
    )
    expect(unitForGoalType("endurance", "duration")).toBe("mins")
  })
})

describe("buildGoalInsert", () => {
  it("builds a weight goal insert", () => {
    const insert = buildGoalInsert(
      { ...initialGoalFormState, targetValue: "180" },
      "user-1"
    )
    expect(insert).toEqual({
      user_id: "user-1",
      goal_type: "weight",
      target_value: 180,
      current_value: 0,
      unit: "lbs",
    })
  })

  it("includes the exercise for strength goals", () => {
    const insert = buildGoalInsert(
      {
        ...initialGoalFormState,
        goalType: "strength",
        exerciseId: "chest-press-machine-flat",
        targetValue: "225",
      },
      "user-1"
    )
    expect(insert.exercise_id).toBe("chest-press-machine-flat")
    expect(insert.unit).toBe("lbs")
  })

  it("ignores a stray exercise on a weight goal", () => {
    const insert = buildGoalInsert(
      { ...initialGoalFormState, exerciseId: "treadmill-run", targetValue: "180" },
      "user-1"
    )
    expect(insert.exercise_id).toBeUndefined()
  })

  it("carries the endurance metric into the unit", () => {
    const insert = buildGoalInsert(
      {
        ...initialGoalFormState,
        goalType: "endurance",
        enduranceMetric: "distance",
        targetValue: "3",
      },
      "user-1"
    )
    expect(insert.unit).toBe(ENDURANCE_DISTANCE_UNIT)
  })

  it("includes the deadline only when one was picked", () => {
    const withDeadline = buildGoalInsert(
      { ...initialGoalFormState, targetValue: "180", deadline: "2026-12-31" },
      "user-1"
    )
    expect(withDeadline.deadline).toBe("2026-12-31")

    const without = buildGoalInsert(
      { ...initialGoalFormState, targetValue: "180" },
      "user-1"
    )
    expect(without.deadline).toBeUndefined()
  })

  it.each(["", "abc", "0", "-5"])(
    "throws on an invalid target %j",
    (targetValue) => {
      expect(() =>
        buildGoalInsert({ ...initialGoalFormState, targetValue }, "user-1")
      ).toThrow(/positive number/)
    }
  )
})
