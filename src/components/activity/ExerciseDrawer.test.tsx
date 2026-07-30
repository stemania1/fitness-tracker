// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import { makeExercise, type ActiveExercise } from "@/lib/active-workout"
import type { ExerciseDefinition } from "@/data/exercises"
import { ExerciseDrawer } from "./ExerciseDrawer"

afterEach(cleanup)

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

function complete(ex: ActiveExercise, n: number): ActiveExercise {
  return {
    ...ex,
    sets: ex.sets.map((s, i) => (i < n ? { ...s, completed: true } : s)),
  }
}

function setup(over: Partial<React.ComponentProps<typeof ExerciseDrawer>> = {}) {
  const props = {
    exercises: [
      makeExercise(def()),
      makeExercise(def({ id: "lat-pulldown", name: "Lat Pulldown" })),
    ],
    currentIdx: 0,
    caloriesFor: () => 0,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  render(<ExerciseDrawer {...props} />)
  return props
}

describe("ExerciseDrawer", () => {
  it("lists every exercise with its set progress", () => {
    setup()
    expect(screen.getByText("Chest Press")).toBeInTheDocument()
    expect(screen.getByText("Lat Pulldown")).toBeInTheDocument()
    expect(screen.getAllByText("0/3 sets")).toHaveLength(2)
  })

  it("numbers exercises that are not finished", () => {
    setup()
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("shows progress for a partly finished exercise", () => {
    setup({ exercises: [complete(makeExercise(def()), 2)] })
    expect(screen.getByText("2/3 sets")).toBeInTheDocument()
    // Still numbered — not all sets are done.
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("marks a fully completed exercise with a check instead of its number", () => {
    setup({ exercises: [complete(makeExercise(def()), 3)] })
    expect(screen.getByText("3/3 sets")).toBeInTheDocument()
    expect(screen.queryByText("1")).toBeNull()
  })

  it("flags the exercise currently open", () => {
    setup({ currentIdx: 1 })
    const current = screen.getAllByRole("button", { current: true })
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toContain("Lat Pulldown")
  })

  it("shows calories only when there are any", () => {
    setup({ caloriesFor: (ex) => (ex.name === "Chest Press" ? 42 : 0) })
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("selects the tapped exercise", async () => {
    const { onSelect } = setup()
    await userEvent.click(screen.getByText("Lat Pulldown"))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it("closes from the close button and from the backdrop", async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("renders nothing but the header for an empty workout", () => {
    setup({ exercises: [] })
    expect(screen.getByText("Exercises")).toBeInTheDocument()
    expect(screen.queryByText(/sets/)).toBeNull()
  })
})
