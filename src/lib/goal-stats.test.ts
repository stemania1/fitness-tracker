import { describe, it, expect } from "vitest"
import {
  getWeekLabel,
  calcWeeklyStreak,
  calcVolumeByWeek,
  weightGoalPercent,
} from "./goal-stats"

describe("getWeekLabel", () => {
  it("labels dates in the same week identically and different weeks distinctly", () => {
    const a = getWeekLabel("2026-07-06T12:00:00")
    const b = getWeekLabel("2026-07-08T12:00:00")
    const c = getWeekLabel("2026-07-20T12:00:00")
    expect(a).toMatch(/^W\d+$/)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

describe("calcWeeklyStreak", () => {
  it("counts consecutive recent weeks meeting the target", () => {
    // 3 workouts in one week, 3 in the next → streak of 2 at target 3.
    const logs = [
      { started_at: "2026-07-06T10:00:00" },
      { started_at: "2026-07-07T10:00:00" },
      { started_at: "2026-07-08T10:00:00" },
      { started_at: "2026-07-13T10:00:00" },
      { started_at: "2026-07-14T10:00:00" },
      { started_at: "2026-07-15T10:00:00" },
    ]
    expect(calcWeeklyStreak(logs, 3)).toBe(2)
  })

  it("stops the streak at a week below target", () => {
    const logs = [
      { started_at: "2026-07-06T10:00:00" }, // week A: 1 (below)
      { started_at: "2026-07-13T10:00:00" }, // week B: 2 (meets)
      { started_at: "2026-07-14T10:00:00" },
    ]
    expect(calcWeeklyStreak(logs, 2)).toBe(1) // only the latest week
  })

  it("returns 0 for empty logs or non-positive target", () => {
    expect(calcWeeklyStreak([], 3)).toBe(0)
    expect(calcWeeklyStreak([{ started_at: "2026-07-06T10:00:00" }], 0)).toBe(0)
  })
})

describe("calcVolumeByWeek", () => {
  it("sums weight × reps per week and keeps the last 12", () => {
    const data = [
      {
        started_at: "2026-07-06T10:00:00",
        exercise_logs: [
          { set_logs: [{ weight: 100, reps: 10 }, { weight: 90, reps: 8 }] },
        ],
      },
      {
        started_at: "2026-07-13T10:00:00",
        exercise_logs: [{ set_logs: [{ weight: 50, reps: 12 }] }],
      },
    ]
    const out = calcVolumeByWeek(data)
    expect(out).toHaveLength(2)
    expect(out[0].volume).toBe(1720) // 1000 + 720
    expect(out[1].volume).toBe(600)
  })

  it("ignores sets missing weight or reps", () => {
    const out = calcVolumeByWeek([
      {
        started_at: "2026-07-06T10:00:00",
        exercise_logs: [
          { set_logs: [{ weight: null, reps: 10 }, { weight: 40, reps: null }] },
        ],
      },
    ])
    expect(out[0].volume).toBe(0)
  })
})

describe("weightGoalPercent", () => {
  it("measures progress from the first logged weight toward the target", () => {
    // Started at 250, now 225, aiming for 200 → halfway.
    expect(weightGoalPercent(225, 200, 250)).toBe(50)
  })

  it("clamps overshoot to 100 and a wrong-direction trend to 0", () => {
    expect(weightGoalPercent(195, 200, 250)).toBe(100)
    expect(weightGoalPercent(255, 200, 250)).toBe(0)
  })

  it("reads 0 with no logged baseline (baseline falls back to current)", () => {
    expect(weightGoalPercent(225, 200, undefined)).toBe(0)
  })

  it("doesn't divide by zero when the baseline equals the target", () => {
    expect(Number.isFinite(weightGoalPercent(210, 200, 200))).toBe(true)
  })
})
