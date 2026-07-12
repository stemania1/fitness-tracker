import { describe, it, expect } from "vitest"
import { buildGoalTrend, type DatedExerciseRow } from "./goal-trend"

const rows: DatedExerciseRow[] = [
  { staticExerciseId: "lat", date: "2026-07-01T12:00:00Z", weights: [100, 90], sessionMinutes: 0 },
  { staticExerciseId: "lat", date: "2026-07-08T12:00:00Z", weights: [110], sessionMinutes: 0 },
  { staticExerciseId: "bike", date: "2026-07-08T12:00:00Z", weights: [], sessionMinutes: 30 },
  { staticExerciseId: "lat", date: "2026-07-01T18:00:00Z", weights: [105], sessionMinutes: 0 }, // same day, higher
]

describe("buildGoalTrend", () => {
  it("returns one ascending point per day using the day's top weight (strength)", () => {
    const t = buildGoalTrend(rows, "lat", "strength")
    expect(t).toEqual([
      { date: "2026-07-01", value: 105 }, // max of 100/90/105 that day
      { date: "2026-07-08", value: 110 },
    ])
  })

  it("uses session minutes for an endurance goal", () => {
    const t = buildGoalTrend(rows, "bike", "endurance")
    expect(t).toEqual([{ date: "2026-07-08", value: 30 }])
  })

  it("ignores other exercises and zero/empty values", () => {
    expect(buildGoalTrend(rows, "never", "strength")).toEqual([])
    expect(
      buildGoalTrend(
        [{ staticExerciseId: "x", date: "2026-07-01T00:00:00Z", weights: [0], sessionMinutes: 0 }],
        "x",
        "strength"
      )
    ).toEqual([])
  })
})
