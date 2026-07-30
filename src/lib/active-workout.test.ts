import { describe, it, expect } from "vitest"
import type { ExerciseDefinition } from "@/data/exercises"
import {
  makeSet,
  makeExercise,
  isTreadmill,
  isOutdoorRun,
  isDistanceCardio,
  computeSpeedMph,
  formatPace,
  formatTimer,
  type ActiveExercise,
} from "./active-workout"

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

function ex(over: Partial<ActiveExercise> = {}): ActiveExercise {
  return { ...makeExercise(def()), ...over }
}

describe("makeSet", () => {
  it("starts every metric null and incomplete", () => {
    expect(makeSet()).toEqual({
      reps: null,
      weight: null,
      durationMins: null,
      distanceMiles: null,
      speedMph: null,
      inclinePercent: null,
      rpe: null,
      completed: false,
    })
  })

  it("returns a fresh object each call (sets must not share state)", () => {
    const a = makeSet()
    const b = makeSet()
    a.reps = 10
    expect(b.reps).toBeNull()
  })
})

describe("makeExercise", () => {
  it("carries the catalog definition across", () => {
    const e = makeExercise(def())
    expect(e.exerciseId).toBe("chest-press-machine-flat")
    expect(e.name).toBe("Chest Press Machine")
    expect(e.muscleGroups).toEqual(["chest", "triceps"])
    expect(e.exerciseType).toBe("strength")
    expect(e.equipmentId).toBe("chest-press-machine")
  })

  it("creates defaultSets blank sets", () => {
    expect(makeExercise(def({ defaultSets: 4 })).sets).toHaveLength(4)
    expect(makeExercise(def({ defaultSets: 4 })).sets[0]).toEqual(makeSet())
  })

  it("falls back to 3 sets when the catalog says 0", () => {
    expect(makeExercise(def({ defaultSets: 0 })).sets).toHaveLength(3)
  })

  it("gives each set its own object", () => {
    const e = makeExercise(def({ defaultSets: 3 }))
    e.sets[0].reps = 10
    expect(e.sets[1].reps).toBeNull()
  })

  it("defaults rest to 60s and takes an override", () => {
    expect(makeExercise(def()).restSeconds).toBe(60)
    expect(makeExercise(def(), 90).restSeconds).toBe(90)
  })

  it("prefers an explicit repsTarget over the catalog default", () => {
    expect(makeExercise(def(), 60, "5x5").repsTarget).toBe("5x5")
  })

  it("falls back to the catalog default reps for freestyle adds", () => {
    expect(makeExercise(def()).repsTarget).toBe("8-12")
  })

  it("defaults assisted to false, and honours the catalog flag", () => {
    expect(makeExercise(def()).assisted).toBe(false)
    expect(makeExercise(def({ assisted: true })).assisted).toBe(true)
  })
})

describe("cardio classification", () => {
  it("detects the treadmill by equipment", () => {
    expect(isTreadmill(ex({ equipmentId: "treadmill" }))).toBe(true)
    expect(isTreadmill(ex({ equipmentId: "rower" }))).toBe(false)
  })

  it("detects the outdoor run by exercise id", () => {
    expect(isOutdoorRun(ex({ exerciseId: "outdoor-run" }))).toBe(true)
    expect(isOutdoorRun(ex({ exerciseId: "treadmill-walk" }))).toBe(false)
  })

  it("treats treadmill and outdoor run as distance cardio", () => {
    expect(isDistanceCardio(ex({ equipmentId: "treadmill" }))).toBe(true)
    expect(isDistanceCardio(ex({ exerciseId: "outdoor-run" }))).toBe(true)
  })

  it("does not treat a rower as distance cardio", () => {
    expect(
      isDistanceCardio(ex({ equipmentId: "rower", exerciseId: "rowing" }))
    ).toBe(false)
  })
})

describe("computeSpeedMph", () => {
  it("converts distance + duration to mph", () => {
    expect(computeSpeedMph(3, 30)).toBe(6)
    expect(computeSpeedMph(1, 60)).toBe(1)
  })

  it("returns null when either input is missing", () => {
    expect(computeSpeedMph(null, 30)).toBeNull()
    expect(computeSpeedMph(3, null)).toBeNull()
    expect(computeSpeedMph(null, null)).toBeNull()
  })

  it("returns null for zero or negative inputs rather than dividing by zero", () => {
    expect(computeSpeedMph(0, 30)).toBeNull()
    expect(computeSpeedMph(3, 0)).toBeNull()
    expect(computeSpeedMph(-1, 30)).toBeNull()
    expect(computeSpeedMph(3, -30)).toBeNull()
  })
})

describe("formatPace", () => {
  it("formats minutes per mile", () => {
    expect(formatPace(3, 30)).toBe("10:00")
    expect(formatPace(2, 19)).toBe("9:30")
  })

  it("zero-pads the seconds", () => {
    expect(formatPace(1, 8.1)).toBe("8:06")
  })

  it("renders an em dash for missing or non-positive input", () => {
    expect(formatPace(null, 30)).toBe("—")
    expect(formatPace(3, null)).toBe("—")
    expect(formatPace(0, 30)).toBe("—")
    expect(formatPace(3, 0)).toBe("—")
  })
})

describe("formatTimer", () => {
  it("formats under an hour as M:SS", () => {
    expect(formatTimer(0)).toBe("0:00")
    expect(formatTimer(5)).toBe("0:05")
    expect(formatTimer(65)).toBe("1:05")
    expect(formatTimer(3599)).toBe("59:59")
  })

  it("switches to H:MM:SS at an hour", () => {
    expect(formatTimer(3600)).toBe("1:00:00")
    expect(formatTimer(3661)).toBe("1:01:01")
    expect(formatTimer(36000)).toBe("10:00:00")
  })
})
