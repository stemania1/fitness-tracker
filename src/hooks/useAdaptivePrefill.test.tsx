// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, cleanup } from "@testing-library/react"
import { useAdaptivePrefill } from "./useAdaptivePrefill"
import {
  makeSet,
  type ActiveExercise,
  type ActiveWorkout,
} from "@/lib/active-workout"

function exercise(overrides: Partial<ActiveExercise> = {}): ActiveExercise {
  return {
    exerciseId: "chest-press-machine-flat",
    name: "Chest Press Machine",
    muscleGroups: ["chest"],
    exerciseType: "strength",
    assisted: false,
    equipmentId: "chest-press-machine",
    repsTarget: "8-12",
    sets: [makeSet(), makeSet(), makeSet()],
    notes: "",
    restSeconds: 60,
    ...overrides,
  }
}

const history = {
  previousSets: [
    { weight: 100, reps: 12 },
    { weight: 100, reps: 12 },
    { weight: 100, reps: 12 },
  ],
}

afterEach(() => {
  cleanup()
})

describe("useAdaptivePrefill", () => {
  it("waits for history, then applies the prefill through setWorkout", () => {
    const setWorkout = vi.fn()
    const ex = exercise()
    const { rerender } = renderHook(
      ({ hist }: { hist: typeof history | undefined }) =>
        useAdaptivePrefill(ex, hist, setWorkout),
      { initialProps: { hist: undefined as typeof history | undefined } }
    )
    // No history yet — nothing applied, exercise stays unmarked.
    expect(setWorkout).not.toHaveBeenCalled()

    rerender({ hist: history })
    expect(setWorkout).toHaveBeenCalledTimes(1)

    // The functional update writes a weight into every set.
    const updater = setWorkout.mock.calls[0][0] as (
      prev: ActiveWorkout | null
    ) => ActiveWorkout | null
    const workout: ActiveWorkout = {
      name: "Test",
      templateId: null,
      startedAt: new Date("2026-08-07T10:00:00Z"),
      exercises: [ex],
    }
    const next = updater(workout)!
    expect(next.exercises[0].sets.every((s) => s.weight != null)).toBe(true)
  })

  it("runs once per exercise — a later rerender doesn't clobber edits", () => {
    const setWorkout = vi.fn()
    const ex = exercise()
    const { rerender } = renderHook(() =>
      useAdaptivePrefill(ex, history, setWorkout)
    )
    expect(setWorkout).toHaveBeenCalledTimes(1)
    rerender()
    expect(setWorkout).toHaveBeenCalledTimes(1)
  })

  it("never prefills cardio", () => {
    const setWorkout = vi.fn()
    renderHook(() =>
      useAdaptivePrefill(exercise({ exerciseType: "cardio" }), history, setWorkout)
    )
    expect(setWorkout).not.toHaveBeenCalled()
  })

  it("marks an exercise with no previous session as handled without applying", () => {
    const setWorkout = vi.fn()
    const ex = exercise()
    const empty: typeof history = { previousSets: [] }
    const { rerender } = renderHook(
      ({ hist }: { hist: typeof history }) =>
        useAdaptivePrefill(ex, hist, setWorkout),
      { initialProps: { hist: empty } }
    )
    expect(setWorkout).not.toHaveBeenCalled()
    // Even if history later shows up, the decision was made for this session.
    rerender({ hist: history })
    expect(setWorkout).not.toHaveBeenCalled()
  })
})
