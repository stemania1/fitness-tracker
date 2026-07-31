import { describe, it, expect } from "vitest"
import {
  embeddedName,
  toActiveExercise,
  plannedToActive,
  remainingPlannedExercises,
  templateRowsToActive,
  loggedExerciseNames,
  DEFAULT_TEMPLATE_SETS,
  DEFAULT_TEMPLATE_REST_SECONDS,
  type TemplateExerciseRow,
} from "./workout-init"
import type { ExerciseDefinition } from "@/data/exercises"
import type { PlannedExercise } from "./todays-workout"

function def(over: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    id: "bench-press",
    name: "Bench Press",
    muscleGroups: ["chest"],
    exerciseType: "strength",
    equipmentId: "barbell",
    ...over,
  } as ExerciseDefinition
}

function planned(over: Partial<PlannedExercise> = {}): PlannedExercise {
  return {
    exerciseId: "bench-press",
    sets: 3,
    reps: "8-12",
    restSeconds: 90,
    notes: null,
    ...over,
  }
}

function row(over: Partial<TemplateExerciseRow> = {}): TemplateExerciseRow {
  return {
    exercise_id: "uuid-1",
    sets: 4,
    reps: "6-8",
    rest_seconds: 120,
    order_index: 0,
    exercises: { name: "Bench Press" },
    ...over,
  }
}

describe("embeddedName", () => {
  // PostgREST returns a to-one relation either way depending on how it infers
  // the relationship, and the logger has been hit by both.
  it("reads the name from an object or a single-element array", () => {
    expect(embeddedName({ name: "Squat" })).toBe("Squat")
    expect(embeddedName([{ name: "Squat" }])).toBe("Squat")
  })

  it("is null for a missing or empty relation", () => {
    expect(embeddedName(null)).toBeNull()
    expect(embeddedName(undefined)).toBeNull()
    expect(embeddedName([])).toBeNull()
  })
})

describe("toActiveExercise", () => {
  it("carries the catalog identity and the prescription", () => {
    const ex = toActiveExercise(def(), {
      sets: 3,
      reps: "8-12",
      restSeconds: 90,
      notes: "slow eccentric",
    })
    expect(ex).toMatchObject({
      exerciseId: "bench-press",
      name: "Bench Press",
      muscleGroups: ["chest"],
      exerciseType: "strength",
      equipmentId: "barbell",
      repsTarget: "8-12",
      restSeconds: 90,
      notes: "slow eccentric",
      assisted: false,
    })
    expect(ex.sets).toHaveLength(3)
  })

  it("starts every set blank and uncompleted", () => {
    const ex = toActiveExercise(def(), { sets: 2, reps: null, restSeconds: 60 })
    for (const s of ex.sets) {
      expect(s.completed).toBe(false)
      expect(s.weight).toBeNull()
      expect(s.reps).toBeNull()
    }
  })

  it("gives each set its own object, so editing one doesn't edit them all", () => {
    const ex = toActiveExercise(def(), { sets: 3, reps: null, restSeconds: 60 })
    expect(ex.sets[0]).not.toBe(ex.sets[1])
  })

  it("defaults absent notes to empty and carries the assisted flag", () => {
    const ex = toActiveExercise(def({ assisted: true }), {
      sets: 1,
      reps: null,
      restSeconds: 60,
    })
    expect(ex.notes).toBe("")
    expect(ex.assisted).toBe(true)
  })
})

describe("plannedToActive", () => {
  it("maps planned exercises by catalog id, keeping order", () => {
    const catalog = [def(), def({ id: "squat", name: "Squat" })]
    const out = plannedToActive(
      [planned({ exerciseId: "squat", sets: 5 }), planned()],
      catalog
    )
    expect(out.map((e) => e.name)).toEqual(["Squat", "Bench Press"])
    expect(out[0].sets).toHaveLength(5)
  })

  // A plan referencing an exercise the catalog no longer carries must not
  // render a nameless row in the logger.
  it("drops an entry whose catalog id is unknown", () => {
    const out = plannedToActive([planned({ exerciseId: "ghost" })], [def()])
    expect(out).toEqual([])
  })
})

describe("remainingPlannedExercises", () => {
  it("omits exercises already logged in the workout being appended to", () => {
    const catalog = [def(), def({ id: "squat", name: "Squat" })]
    const out = remainingPlannedExercises(
      [planned(), planned({ exerciseId: "squat" })],
      new Set(["Bench Press"]),
      catalog
    )
    expect(out.map((e) => e.name)).toEqual(["Squat"])
  })

  it("returns everything when nothing has been logged yet", () => {
    const out = remainingPlannedExercises([planned()], new Set(), [def()])
    expect(out).toHaveLength(1)
  })
})

describe("templateRowsToActive", () => {
  it("matches template rows to the catalog by name", () => {
    const out = templateRowsToActive([row()], [def()])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      exerciseId: "bench-press",
      repsTarget: "6-8",
      restSeconds: 120,
    })
    expect(out[0].sets).toHaveLength(4)
  })

  it("handles the embedded relation arriving as an array", () => {
    const out = templateRowsToActive(
      [row({ exercises: [{ name: "Bench Press" }] })],
      [def()]
    )
    expect(out).toHaveLength(1)
  })

  // Worth pinning: a template carrying an exercise the static catalog doesn't
  // have loses it silently, because name is the only key the two share.
  it("drops a row whose name isn't in the catalog", () => {
    const out = templateRowsToActive([row({ exercises: { name: "Ghost" } })], [def()])
    expect(out).toEqual([])
  })

  it("drops a row with no embedded exercise at all", () => {
    expect(templateRowsToActive([row({ exercises: null })], [def()])).toEqual([])
  })

  it("falls back to defaults for absent sets and rest", () => {
    const out = templateRowsToActive(
      [row({ sets: null, rest_seconds: null })],
      [def()]
    )
    expect(out[0].sets).toHaveLength(DEFAULT_TEMPLATE_SETS)
    expect(out[0].restSeconds).toBe(DEFAULT_TEMPLATE_REST_SECONDS)
  })

  it("keeps a null reps target rather than inventing one", () => {
    const out = templateRowsToActive([row({ reps: null })], [def()])
    expect(out[0].repsTarget).toBeNull()
  })
})

describe("loggedExerciseNames", () => {
  it("collects names across both embedded shapes and skips empties", () => {
    const names = loggedExerciseNames([
      { exercises: { name: "Bench Press" } },
      { exercises: [{ name: "Squat" }] },
      { exercises: null },
    ])
    expect(names).toEqual(new Set(["Bench Press", "Squat"]))
  })
})
