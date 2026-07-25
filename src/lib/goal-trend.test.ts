import { describe, it, expect } from "vitest"
import { buildGoalTrend, type DatedExerciseRow } from "./goal-trend"

const rows: DatedExerciseRow[] = [
  {
    staticExerciseId: "lat",
    date: "2026-07-01T12:00:00Z",
    sets: [
      { weight: 100, reps: 5 }, // e1RM 116.7 → 117
      { weight: 90, reps: 8 }, // e1RM 114
    ],
    sessionMinutes: 0,
  },
  {
    staticExerciseId: "lat",
    date: "2026-07-08T12:00:00Z",
    sets: [{ weight: 110, reps: 5 }], // e1RM 128.3 → 128
    sessionMinutes: 0,
  },
  {
    staticExerciseId: "bike",
    date: "2026-07-08T12:00:00Z",
    sets: [],
    sessionMinutes: 30,
  },
  {
    staticExerciseId: "lat",
    date: "2026-07-01T18:00:00Z",
    sets: [{ weight: 105, reps: 3 }], // e1RM 115.5 → 116, same day, lower
    sessionMinutes: 0,
  },
]

describe("buildGoalTrend", () => {
  it("returns one ascending point per day using the day's best e1RM (strength)", () => {
    const t = buildGoalTrend(rows, "lat", "strength")
    expect(t).toEqual([
      { date: "2026-07-01", value: 117 }, // best of 117 / 114 / 116 that day
      { date: "2026-07-08", value: 128 },
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
        [
          {
            staticExerciseId: "x",
            date: "2026-07-01T00:00:00Z",
            sets: [{ weight: 0, reps: 5 }],
            sessionMinutes: 0,
          },
        ],
        "x",
        "strength"
      )
    ).toEqual([])
  })

  it("falls back to the heaviest weight when reps are missing", () => {
    const t = buildGoalTrend(
      [
        {
          staticExerciseId: "row",
          date: "2026-07-02T00:00:00Z",
          sets: [{ weight: 135, reps: null }],
          sessionMinutes: 0,
        },
      ],
      "row",
      "strength"
    )
    expect(t).toEqual([{ date: "2026-07-02", value: 135 }])
  })
})
