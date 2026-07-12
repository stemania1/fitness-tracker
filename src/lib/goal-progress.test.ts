import { describe, it, expect } from "vitest"
import {
  computeExerciseBests,
  liveGoalCurrent,
  goalProgressPercent,
  type LoggedExerciseRow,
} from "./goal-progress"

const rows: LoggedExerciseRow[] = [
  { staticExerciseId: "lat-pulldown", weights: [100, 110], sessionMinutes: 0 },
  { staticExerciseId: "lat-pulldown", weights: [120], sessionMinutes: 0 },
  { staticExerciseId: "stationary-bike", weights: [], sessionMinutes: 20 },
  { staticExerciseId: "stationary-bike", weights: [], sessionMinutes: 35 },
  { staticExerciseId: null, weights: [999], sessionMinutes: 999 }, // unmapped — ignored
]

describe("computeExerciseBests", () => {
  it("takes the heaviest weight and longest session per exercise", () => {
    const b = computeExerciseBests(rows)
    expect(b.get("lat-pulldown")).toEqual({
      bestWeight: 120,
      bestSessionMinutes: null,
    })
    expect(b.get("stationary-bike")).toEqual({
      bestWeight: null,
      bestSessionMinutes: 35,
    })
  })

  it("ignores unmapped exercises and non-positive values", () => {
    const b = computeExerciseBests([
      { staticExerciseId: null, weights: [500], sessionMinutes: 500 },
      { staticExerciseId: "x", weights: [0, -5], sessionMinutes: 0 },
    ])
    expect(b.has("null")).toBe(false)
    expect(b.get("x")).toEqual({ bestWeight: null, bestSessionMinutes: null })
  })
})

describe("liveGoalCurrent", () => {
  const bests = computeExerciseBests(rows)

  it("uses best weight for a strength goal", () => {
    expect(
      liveGoalCurrent(
        { goal_type: "strength", exercise_id: "lat-pulldown", current_value: 0 },
        bests
      )
    ).toBe(120)
  })

  it("uses best session minutes for an endurance goal", () => {
    expect(
      liveGoalCurrent(
        { goal_type: "endurance", exercise_id: "stationary-bike", current_value: 0 },
        bests
      )
    ).toBe(35)
  })

  it("returns 0 when there's no logged data for the exercise yet", () => {
    expect(
      liveGoalCurrent(
        { goal_type: "strength", exercise_id: "never-done", current_value: 0 },
        bests
      )
    ).toBe(0)
  })

  it("falls back to stored current_value for weight/consistency goals", () => {
    expect(
      liveGoalCurrent(
        { goal_type: "weight", exercise_id: null, current_value: 182 },
        bests
      )
    ).toBe(182)
  })
})

describe("goalProgressPercent", () => {
  it("clamps between 0 and 100", () => {
    expect(goalProgressPercent(50, 100)).toBe(50)
    expect(goalProgressPercent(120, 100)).toBe(100)
    expect(goalProgressPercent(0, 100)).toBe(0)
    expect(goalProgressPercent(10, 0)).toBe(0)
  })
})
