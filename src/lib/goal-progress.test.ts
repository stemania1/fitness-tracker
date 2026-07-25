import { describe, it, expect } from "vitest"
import {
  computeExerciseBests,
  liveGoalCurrent,
  goalProgressPercent,
  type LoggedExerciseRow,
} from "./goal-progress"

const rows: LoggedExerciseRow[] = [
  {
    staticExerciseId: "lat-pulldown",
    sets: [
      { weight: 100, reps: 10 },
      { weight: 110, reps: 8 },
    ],
    sessionMinutes: 0,
  },
  {
    staticExerciseId: "lat-pulldown",
    sets: [{ weight: 120, reps: 5 }],
    sessionMinutes: 0,
  },
  { staticExerciseId: "stationary-bike", sets: [], sessionMinutes: 20 },
  { staticExerciseId: "stationary-bike", sets: [], sessionMinutes: 35 },
  {
    staticExerciseId: null,
    sets: [{ weight: 999, reps: 1 }],
    sessionMinutes: 999,
  }, // unmapped — ignored
]

describe("computeExerciseBests", () => {
  it("tracks heaviest weight, best estimated 1RM, and longest session", () => {
    const b = computeExerciseBests(rows)
    // Best e1RM: 120×5 → 120*(1+5/30) = 140; beats 110×8 (≈139.3) and 100×10.
    expect(b.get("lat-pulldown")).toEqual({
      bestWeight: 120,
      bestE1RM: 140,
      bestSessionMinutes: null,
    })
    expect(b.get("stationary-bike")).toEqual({
      bestWeight: null,
      bestE1RM: null,
      bestSessionMinutes: 35,
    })
  })

  it("ignores unmapped exercises and non-positive weights", () => {
    const b = computeExerciseBests([
      { staticExerciseId: null, sets: [{ weight: 500, reps: 1 }], sessionMinutes: 500 },
      {
        staticExerciseId: "x",
        sets: [
          { weight: 0, reps: 5 },
          { weight: -5, reps: 5 },
        ],
        sessionMinutes: 0,
      },
    ])
    expect(b.has("null")).toBe(false)
    expect(b.get("x")).toEqual({
      bestWeight: null,
      bestE1RM: null,
      bestSessionMinutes: null,
    })
  })

  it("still tracks weight when reps are missing (e1RM stays null)", () => {
    const b = computeExerciseBests([
      { staticExerciseId: "y", sets: [{ weight: 95, reps: null }], sessionMinutes: 0 },
    ])
    expect(b.get("y")).toEqual({
      bestWeight: 95,
      bestE1RM: null,
      bestSessionMinutes: null,
    })
  })
})

describe("liveGoalCurrent", () => {
  const bests = computeExerciseBests(rows)

  it("uses best estimated 1RM for a strength goal", () => {
    expect(
      liveGoalCurrent(
        { goal_type: "strength", exercise_id: "lat-pulldown", current_value: 0 },
        bests
      )
    ).toBe(140)
  })

  it("falls back to heaviest weight for strength when no reps were logged", () => {
    const b = computeExerciseBests([
      { staticExerciseId: "z", sets: [{ weight: 80, reps: null }], sessionMinutes: 0 },
    ])
    expect(
      liveGoalCurrent(
        { goal_type: "strength", exercise_id: "z", current_value: 0 },
        b
      )
    ).toBe(80)
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
