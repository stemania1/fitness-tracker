import { describe, it, expect } from "vitest"
import { toDatedExerciseRows, type JoinedWorkoutRow } from "./goal-exercise-rows"

const catalog = [
  { id: "chest-press", name: "Chest Press Machine" },
  { id: "treadmill", name: "Treadmill" },
]

function workout(
  exerciseLogs: JoinedWorkoutRow["exercise_logs"]
): JoinedWorkoutRow {
  return { started_at: "2026-08-01T10:00:00Z", exercise_logs: exerciseLogs }
}

describe("toDatedExerciseRows", () => {
  it("resolves the logged exercise name to its catalog id, case-insensitively", () => {
    const rows = toDatedExerciseRows(
      [
        workout([
          {
            exercises: { name: "CHEST PRESS MACHINE" },
            set_logs: [
              {
                weight: 100,
                reps: 10,
                duration_mins: null,
                distance_miles: null,
              },
            ],
          },
        ]),
      ],
      catalog
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].staticExerciseId).toBe("chest-press")
    expect(rows[0].date).toBe("2026-08-01T10:00:00Z")
    expect(rows[0].sets).toEqual([{ weight: 100, reps: 10 }])
  })

  it("handles the relation arriving as an array (Supabase embed shape)", () => {
    const rows = toDatedExerciseRows(
      [
        workout([
          {
            exercises: [{ name: "Treadmill" }],
            set_logs: [],
          },
        ]),
      ],
      catalog
    )
    expect(rows[0].staticExerciseId).toBe("treadmill")
  })

  it("keeps rows whose exercise isn't in the catalog, with a null id", () => {
    const rows = toDatedExerciseRows(
      [
        workout([
          {
            exercises: { name: "Mystery Machine" },
            set_logs: [],
          },
          { exercises: null, set_logs: [] },
        ]),
      ],
      catalog
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].staticExerciseId).toBeNull()
    expect(rows[1].staticExerciseId).toBeNull()
  })

  it("sums session minutes and miles across sets", () => {
    const rows = toDatedExerciseRows(
      [
        workout([
          {
            exercises: { name: "Treadmill" },
            set_logs: [
              { weight: null, reps: null, duration_mins: 20, distance_miles: 1.5 },
              { weight: null, reps: null, duration_mins: 10, distance_miles: null },
            ],
          },
        ]),
      ],
      catalog
    )
    expect(rows[0].sessionMinutes).toBe(30)
    expect(rows[0].sessionDistanceMiles).toBe(1.5)
  })

  it("returns no rows for no workouts", () => {
    expect(toDatedExerciseRows([], catalog)).toEqual([])
  })
})
