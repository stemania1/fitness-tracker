import { describe, it, expect } from "vitest"
import type { ExerciseDefinition } from "@/data/exercises"
import { makeExercise, type ActiveWorkout } from "./active-workout"
import {
  updateSet,
  toggleSetComplete,
  addSet,
  removeSet,
  updateExerciseNotes,
  removeExercise,
  addExercise,
  swapExercise,
  clampIndexAfterRemoval,
} from "./workout-edits"

function def(over: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    id: "chest-press-machine-flat",
    name: "Chest Press Machine",
    equipmentId: "chest-press-machine",
    muscleGroups: ["chest", "triceps"],
    exerciseType: "strength",
    difficulty: "beginner",
    defaultSets: 3,
    defaultReps: "8-12",
    ...over,
  }
}

function workout(): ActiveWorkout {
  return {
    name: "Push Day",
    templateId: null,
    startedAt: new Date("2026-07-30T10:00:00Z"),
    exercises: [
      makeExercise(def(), 90),
      makeExercise(def({ id: "lat-pulldown", name: "Lat Pulldown" }), 60),
    ],
  }
}

describe("updateSet", () => {
  it("merges the patch into the target set only", () => {
    const w = updateSet(workout(), 0, 1, { reps: 10, weight: 135 })
    expect(w.exercises[0].sets[1].reps).toBe(10)
    expect(w.exercises[0].sets[1].weight).toBe(135)
    expect(w.exercises[0].sets[0].reps).toBeNull()
    expect(w.exercises[1].sets[1].reps).toBeNull()
  })

  it("does not mutate the input", () => {
    const before = workout()
    updateSet(before, 0, 0, { reps: 12 })
    expect(before.exercises[0].sets[0].reps).toBeNull()
  })

  it("no-ops on an out-of-range index instead of corrupting the workout", () => {
    const before = workout()
    expect(updateSet(before, 9, 0, { reps: 5 })).toBe(before)
    expect(updateSet(before, 0, 9, { reps: 5 })).toBe(before)
    expect(updateSet(before, -1, 0, { reps: 5 })).toBe(before)
    expect(updateSet(before, 0, -1, { reps: 5 })).toBe(before)
  })
})

describe("toggleSetComplete", () => {
  it("marks a set complete and returns that exercise's rest interval", () => {
    const { workout: w, restSeconds } = toggleSetComplete(workout(), 0, 0)
    expect(w.exercises[0].sets[0].completed).toBe(true)
    expect(restSeconds).toBe(90)
  })

  it("uses the rest interval of the exercise being edited", () => {
    expect(toggleSetComplete(workout(), 1, 0).restSeconds).toBe(60)
  })

  // Un-checking a set you logged by mistake should not start a rest countdown.
  it("returns no rest interval when un-completing", () => {
    const done = toggleSetComplete(workout(), 0, 0).workout
    const { workout: w, restSeconds } = toggleSetComplete(done, 0, 0)
    expect(w.exercises[0].sets[0].completed).toBe(false)
    expect(restSeconds).toBeNull()
  })

  it("no-ops out of range", () => {
    const before = workout()
    const { workout: w, restSeconds } = toggleSetComplete(before, 9, 0)
    expect(w).toBe(before)
    expect(restSeconds).toBeNull()
  })
})

describe("addSet / removeSet", () => {
  it("appends a blank set", () => {
    const w = addSet(workout(), 0)
    expect(w.exercises[0].sets).toHaveLength(4)
    expect(w.exercises[0].sets[3].reps).toBeNull()
    expect(w.exercises[1].sets).toHaveLength(3)
  })

  it("removes the set at the given index", () => {
    const w = removeSet(updateSet(workout(), 0, 1, { reps: 7 }), 0, 1)
    expect(w.exercises[0].sets).toHaveLength(2)
    expect(w.exercises[0].sets.map((s) => s.reps)).toEqual([null, null])
  })

  it("refuses to remove the last set", () => {
    let w = removeSet(workout(), 0, 0)
    w = removeSet(w, 0, 0)
    expect(w.exercises[0].sets).toHaveLength(1)
    const final = removeSet(w, 0, 0)
    expect(final).toBe(w)
  })

  it("no-ops out of range", () => {
    const before = workout()
    expect(addSet(before, 9)).toBe(before)
    expect(removeSet(before, 9, 0)).toBe(before)
    expect(removeSet(before, 0, 9)).toBe(before)
  })
})

describe("updateExerciseNotes", () => {
  it("sets notes on one exercise", () => {
    const w = updateExerciseNotes(workout(), 1, "left shoulder tight")
    expect(w.exercises[1].notes).toBe("left shoulder tight")
    expect(w.exercises[0].notes).toBe("")
  })

  it("no-ops out of range", () => {
    const before = workout()
    expect(updateExerciseNotes(before, 9, "x")).toBe(before)
  })
})

describe("removeExercise / addExercise", () => {
  it("drops the exercise at the index", () => {
    const w = removeExercise(workout(), 0)
    expect(w.exercises).toHaveLength(1)
    expect(w.exercises[0].name).toBe("Lat Pulldown")
  })

  it("appends a new exercise built from the catalog definition", () => {
    const w = addExercise(workout(), def({ id: "row", name: "Seated Row" }))
    expect(w.exercises).toHaveLength(3)
    expect(w.exercises[2].name).toBe("Seated Row")
    expect(w.exercises[2].sets).toHaveLength(3)
  })

  it("no-ops removing out of range", () => {
    const before = workout()
    expect(removeExercise(before, 9)).toBe(before)
  })
})

describe("swapExercise", () => {
  it("swaps identity but keeps sets already entered", () => {
    const logged = updateSet(workout(), 0, 0, { reps: 8, weight: 100 })
    const w = swapExercise(logged, 0, def({ id: "db-press", name: "DB Press", equipmentId: "dumbbells" }))
    expect(w.exercises[0].exerciseId).toBe("db-press")
    expect(w.exercises[0].name).toBe("DB Press")
    expect(w.exercises[0].equipmentId).toBe("dumbbells")
    expect(w.exercises[0].sets[0].reps).toBe(8)
    expect(w.exercises[0].sets[0].weight).toBe(100)
  })

  it("keeps the prescribed rest and rep target", () => {
    const w = swapExercise(workout(), 0, def({ id: "db-press", defaultReps: "5" }))
    expect(w.exercises[0].restSeconds).toBe(90)
    expect(w.exercises[0].repsTarget).toBe("8-12")
  })

  it("carries the substitute's assisted flag", () => {
    const w = swapExercise(workout(), 0, def({ id: "assisted-pullup", assisted: true }))
    expect(w.exercises[0].assisted).toBe(true)
  })

  it("no-ops out of range", () => {
    const before = workout()
    expect(swapExercise(before, 9, def())).toBe(before)
  })
})

describe("clampIndexAfterRemoval", () => {
  it("keeps the cursor put when a later exercise is removed", () => {
    expect(clampIndexAfterRemoval(0, 2, 4)).toBe(0)
    expect(clampIndexAfterRemoval(1, 3, 4)).toBe(1)
  })

  it("shifts the cursor back when an earlier exercise is removed", () => {
    expect(clampIndexAfterRemoval(2, 0, 4)).toBe(1)
    expect(clampIndexAfterRemoval(3, 1, 4)).toBe(2)
  })

  it("clamps into the shortened list when the last one is removed", () => {
    expect(clampIndexAfterRemoval(3, 3, 4)).toBe(2)
  })

  it("returns 0 when the list empties", () => {
    expect(clampIndexAfterRemoval(0, 0, 1)).toBe(0)
  })
})
