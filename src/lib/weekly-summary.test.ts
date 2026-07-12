import { describe, it, expect } from "vitest"
import {
  summarizeWeekTraining,
  formatVolume,
  type WeekExercise,
} from "./weekly-summary"

describe("summarizeWeekTraining", () => {
  it("sums strength volume and counts working sets", () => {
    const exercises: WeekExercise[] = [
      {
        exerciseType: "strength",
        sets: [
          { weight: 100, reps: 10, durationMins: null }, // 1000
          { weight: 90, reps: 8, durationMins: null }, // 720
        ],
      },
    ]
    const s = summarizeWeekTraining(exercises, 1)
    expect(s.strengthVolumeLbs).toBe(1720)
    expect(s.strengthSets).toBe(2)
    expect(s.cardioMinutes).toBe(0)
    expect(s.sessions).toBe(1)
  })

  it("sums cardio minutes and keeps them out of strength volume", () => {
    const exercises: WeekExercise[] = [
      {
        exerciseType: "cardio",
        sets: [
          { weight: null, reps: null, durationMins: 20 },
          { weight: null, reps: null, durationMins: 15 },
        ],
      },
    ]
    const s = summarizeWeekTraining(exercises, 1)
    expect(s.cardioMinutes).toBe(35)
    expect(s.strengthVolumeLbs).toBe(0)
    expect(s.strengthSets).toBe(0)
  })

  it("combines strength and cardio across a mixed session", () => {
    const exercises: WeekExercise[] = [
      {
        exerciseType: "strength",
        sets: [{ weight: 50, reps: 12, durationMins: null }], // 600
      },
      {
        exerciseType: "cardio",
        sets: [{ weight: null, reps: null, durationMins: 18 }],
      },
    ]
    const s = summarizeWeekTraining(exercises, 1)
    expect(s.strengthVolumeLbs).toBe(600)
    expect(s.cardioMinutes).toBe(18)
    expect(s.strengthSets).toBe(1)
  })

  it("counts a strength set with missing weight toward set count but not volume", () => {
    const exercises: WeekExercise[] = [
      {
        exerciseType: "strength",
        sets: [{ weight: null, reps: 8, durationMins: null }],
      },
    ]
    const s = summarizeWeekTraining(exercises, 1)
    expect(s.strengthSets).toBe(1)
    expect(s.strengthVolumeLbs).toBe(0)
  })

  it("treats unknown/null exercise type as strength for set counting", () => {
    const exercises: WeekExercise[] = [
      { exerciseType: null, sets: [{ weight: 40, reps: 10, durationMins: null }] },
    ]
    const s = summarizeWeekTraining(exercises, 2)
    expect(s.strengthVolumeLbs).toBe(400)
    expect(s.strengthSets).toBe(1)
    expect(s.sessions).toBe(2)
  })

  it("returns zeros for an empty week", () => {
    expect(summarizeWeekTraining([], 0)).toEqual({
      strengthVolumeLbs: 0,
      cardioMinutes: 0,
      strengthSets: 0,
      sessions: 0,
    })
  })
})

describe("formatVolume", () => {
  it("abbreviates thousands and passes small numbers through", () => {
    expect(formatVolume(2720)).toBe("2.7k")
    expect(formatVolume(1000)).toBe("1.0k")
    expect(formatVolume(720)).toBe("720")
    expect(formatVolume(0)).toBe("0")
  })
})
