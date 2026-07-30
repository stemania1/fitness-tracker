import { describe, it, expect } from "vitest"
import type { ExerciseDefinition } from "@/data/exercises"
import { makeExercise, type ActiveWorkout } from "./active-workout"
import { updateSet } from "./workout-edits"
import {
  uncheckedExercises,
  workoutDurationMins,
  buildWorkoutPayload,
  isOfflineError,
  saveErrorMessage,
} from "./finish-workout"

const START = new Date("2026-07-30T10:00:00.000Z")

function def(over: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    id: "chest-press",
    name: "Chest Press",
    equipmentId: "chest-press-machine",
    muscleGroups: ["chest"],
    exerciseType: "strength",
    difficulty: "beginner",
    defaultSets: 3,
    defaultReps: "8-12",
    ...over,
  }
}

function workout(over: Partial<ActiveWorkout> = {}): ActiveWorkout {
  return {
    name: "Push Day",
    templateId: "tpl-1",
    startedAt: START,
    exercises: [
      makeExercise(def()),
      makeExercise(def({ id: "lat-pulldown", name: "Lat Pulldown" })),
    ],
    ...over,
  }
}

/** Complete set `setIdx` of exercise `exIdx` with some numbers on it. */
function log(w: ActiveWorkout, exIdx: number, setIdx: number, reps = 10, weight = 100) {
  return updateSet(w, exIdx, setIdx, { reps, weight, completed: true })
}

describe("uncheckedExercises", () => {
  it("returns exercises with no completed set", () => {
    const w = log(workout(), 0, 0)
    expect(uncheckedExercises(w).map((e) => e.name)).toEqual(["Lat Pulldown"])
  })

  it("returns none when every exercise has at least one completed set", () => {
    let w = log(workout(), 0, 0)
    w = log(w, 1, 2)
    expect(uncheckedExercises(w)).toEqual([])
  })

  it("returns none for a null workout", () => {
    expect(uncheckedExercises(null)).toEqual([])
  })
})

describe("workoutDurationMins", () => {
  it("rounds to the nearest minute", () => {
    expect(workoutDurationMins(START, new Date(START.getTime() + 90_000))) .toBe(2)
    expect(workoutDurationMins(START, new Date(START.getTime() + 89_000))).toBe(1)
  })

  it("clamps a finish before the start to 0", () => {
    expect(workoutDurationMins(START, new Date(START.getTime() - 60_000))).toBe(0)
  })
})

describe("buildWorkoutPayload", () => {
  const finishedAt = new Date(START.getTime() + 45 * 60_000)

  it("carries the workout metadata", () => {
    const p = buildWorkoutPayload({
      workout: log(workout(), 0, 0),
      userId: "user-1",
      finishedAt,
    })
    expect(p.userId).toBe("user-1")
    expect(p.name).toBe("Push Day")
    expect(p.templateId).toBe("tpl-1")
    expect(p.startedAt).toBe(START.toISOString())
    expect(p.finishedAt).toBe(finishedAt.toISOString())
    expect(p.durationMins).toBe(45)
  })

  it("keeps only completed sets", () => {
    let w = log(workout(), 0, 0, 10, 100)
    w = log(w, 0, 2, 8, 110)
    const p = buildWorkoutPayload({ workout: w, userId: "u", finishedAt })
    expect(p.exercises).toHaveLength(1)
    expect(p.exercises[0].completedSets).toEqual([
      {
        reps: 10,
        weight: 100,
        durationMins: null,
        distanceMiles: null,
        inclinePercent: null,
        rpe: null,
      },
      {
        reps: 8,
        weight: 110,
        durationMins: null,
        distanceMiles: null,
        inclinePercent: null,
        rpe: null,
      },
    ])
  })

  it("drops exercises with nothing checked off", () => {
    const p = buildWorkoutPayload({
      workout: log(workout(), 1, 0),
      userId: "u",
      finishedAt,
    })
    expect(p.exercises.map((e) => e.exerciseId)).toEqual(["lat-pulldown"])
  })

  // Dropping an exercise leaves a gap rather than renumbering, so the saved
  // order still matches the on-screen order.
  it("keeps the on-screen index of surviving exercises", () => {
    const p = buildWorkoutPayload({
      workout: log(workout(), 1, 0),
      userId: "u",
      finishedAt,
    })
    expect(p.exercises[0].orderIndex).toBe(1)
  })

  it("produces no exercises when nothing was checked off at all", () => {
    const p = buildWorkoutPayload({ workout: workout(), userId: "u", finishedAt })
    expect(p.exercises).toEqual([])
  })

  it("carries exercise notes", () => {
    const w = { ...log(workout(), 0, 0) }
    w.exercises = [...w.exercises]
    w.exercises[0] = { ...w.exercises[0], notes: "felt heavy" }
    const p = buildWorkoutPayload({ workout: w, userId: "u", finishedAt })
    expect(p.exercises[0].notes).toBe("felt heavy")
  })

  it("defaults to creating a new log rather than appending", () => {
    const p = buildWorkoutPayload({
      workout: log(workout(), 0, 0),
      userId: "u",
      finishedAt,
    })
    expect(p.appendToLogId).toBeNull()
    expect(p.orderOffset).toBe(0)
  })

  // On append, workout.exercises holds only the NEW exercises; the offset
  // pushes them past what is already logged against that workout.
  it("threads the append target and offset through", () => {
    const p = buildWorkoutPayload({
      workout: log(workout(), 0, 0),
      userId: "u",
      finishedAt,
      append: { logId: "log-9", orderOffset: 4 },
    })
    expect(p.appendToLogId).toBe("log-9")
    expect(p.orderOffset).toBe(4)
    expect(p.exercises[0].orderIndex).toBe(0)
  })

  it("carries cardio metrics, not just reps and weight", () => {
    const w = updateSet(workout(), 0, 0, {
      durationMins: 30,
      distanceMiles: 3.1,
      inclinePercent: 2,
      rpe: 7,
      completed: true,
    })
    const p = buildWorkoutPayload({ workout: w, userId: "u", finishedAt })
    expect(p.exercises[0].completedSets[0]).toMatchObject({
      durationMins: 30,
      distanceMiles: 3.1,
      inclinePercent: 2,
      rpe: 7,
    })
  })

  // speedMph is derived at display time and deliberately not persisted.
  it("does not persist derived speed", () => {
    const w = updateSet(workout(), 0, 0, { speedMph: 6, completed: true })
    const p = buildWorkoutPayload({ workout: w, userId: "u", finishedAt })
    expect(p.exercises[0].completedSets[0]).not.toHaveProperty("speedMph")
  })
})

describe("isOfflineError", () => {
  it("treats anything as offline when the browser reports offline", () => {
    expect(isOfflineError(new Error("boom"), false)).toBe(true)
  })

  // iOS reports online while requests still fail on a flaky connection.
  it("recognises network failures while nominally online", () => {
    expect(isOfflineError(new Error("Load failed"), true)).toBe(true)
    expect(isOfflineError(new Error("Failed to fetch"), true)).toBe(true)
    expect(isOfflineError(new Error("NetworkError when attempting"), true)).toBe(true)
  })

  it("does not queue a genuine server error", () => {
    expect(isOfflineError(new Error("duplicate key value"), true)).toBe(false)
  })

  it("does not throw on a non-Error rejection", () => {
    expect(isOfflineError(undefined, true)).toBe(false)
    expect(isOfflineError(null, true)).toBe(false)
    expect(isOfflineError({ nope: 1 }, true)).toBe(false)
    expect(isOfflineError("Failed to fetch", true)).toBe(true)
  })

  // Supabase rejects with a plain { message, code } object, NOT an Error — an
  // instanceof check here would miss every real network failure and drop the
  // logged workout instead of queueing it.
  it("recognises a Supabase-style plain error object", () => {
    expect(isOfflineError({ message: "Load failed", code: "" }, true)).toBe(true)
    expect(isOfflineError({ message: "duplicate key" }, true)).toBe(false)
  })

  it("ignores a non-string message", () => {
    expect(isOfflineError({ message: 42 }, true)).toBe(false)
  })
})

describe("saveErrorMessage", () => {
  it("uses the error message when there is one", () => {
    expect(saveErrorMessage(new Error("row level security"))).toBe(
      "row level security"
    )
  })

  it("uses the message from a Supabase-style plain error object", () => {
    expect(saveErrorMessage({ message: "row level security", code: "42501" })).toBe(
      "row level security"
    )
  })

  it("falls back for an empty or non-Error failure", () => {
    expect(saveErrorMessage(new Error(""))).toBe(
      "Couldn't save the workout. Try again."
    )
    expect(saveErrorMessage(undefined)).toBe(
      "Couldn't save the workout. Try again."
    )
    expect(saveErrorMessage({ code: "500" })).toBe(
      "Couldn't save the workout. Try again."
    )
  })
})
