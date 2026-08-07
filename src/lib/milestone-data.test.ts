import { describe, it, expect } from "vitest"
import { buildMilestoneData } from "./milestone-data"

const now = new Date("2026-08-07T12:00:00Z")

function logs(count: number): { started_at: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    started_at: `2026-07-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
  }))
}

describe("buildMilestoneData", () => {
  it("reports counts and first/tenth workout dates from unsorted logs", () => {
    const shuffled = [logs(10)[4], ...logs(10).filter((_, i) => i !== 4)]
    const data = buildMilestoneData(shuffled, [], 0, now)
    expect(data.workoutCount).toBe(10)
    expect(data.firstWorkoutDate).toBe("2026-07-01T10:00:00Z")
    expect(data.tenthWorkoutDate).toBe("2026-07-10T10:00:00Z")
  })

  it("leaves the tenth-workout date null before ten workouts", () => {
    const data = buildMilestoneData(logs(3), [], 0, now)
    expect(data.tenthWorkoutDate).toBeNull()
  })

  it("counts achieved goals and takes the first achievement date", () => {
    const data = buildMilestoneData(
      [],
      [
        { achieved_at: "2026-06-01T00:00:00Z" },
        { achieved_at: null },
        { achieved_at: "2026-07-01T00:00:00Z" },
      ],
      0,
      now
    )
    expect(data.goalsAchievedCount).toBe(2)
    expect(data.firstGoalAchievedDate).toBe("2026-06-01T00:00:00Z")
  })

  it("marks the four-week streak only at 4+ weeks", () => {
    expect(buildMilestoneData([], [], 3, now).fourWeekStreakDate).toBeNull()
    expect(buildMilestoneData([], [], 4, now).fourWeekStreakDate).toBe(
      now.toISOString()
    )
  })
})
