// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, afterEach } from "vitest"
import { makeExercise } from "@/lib/active-workout"
import type { ExerciseDefinition } from "@/data/exercises"
import { UncheckedExercisesDialog } from "./UncheckedExercisesDialog"

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

function setup(
  over: Partial<React.ComponentProps<typeof UncheckedExercisesDialog>> = {}
) {
  const props = {
    exercises: [makeExercise(def())],
    saving: false,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...over,
  }
  render(<UncheckedExercisesDialog {...props} />)
  return props
}

describe("UncheckedExercisesDialog", () => {
  it("names every exercise that will not be saved", () => {
    setup({
      exercises: [
        makeExercise(def()),
        makeExercise(def({ id: "row", name: "Seated Row" })),
      ],
    })
    expect(screen.getByText("• Chest Press")).toBeInTheDocument()
    expect(screen.getByText("• Seated Row")).toBeInTheDocument()
  })

  it("uses singular wording for one exercise", () => {
    setup()
    expect(screen.getByText(/1 exercise has/)).toBeInTheDocument()
  })

  it("uses plural wording for several", () => {
    setup({
      exercises: [
        makeExercise(def()),
        makeExercise(def({ id: "row", name: "Seated Row" })),
      ],
    })
    expect(screen.getByText(/2 exercises have/)).toBeInTheDocument()
  })

  it("cancels back to logging", async () => {
    const { onCancel, onConfirm } = setup()
    await userEvent.click(screen.getByRole("button", { name: "Keep logging" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("confirms the save", async () => {
    const { onConfirm } = setup()
    await userEvent.click(screen.getByRole("button", { name: "Save anyway" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  // Without this a double-tap on a slow connection can fire two saves.
  it("disables confirming while a save is in flight", async () => {
    const { onConfirm } = setup({ saving: true })
    const confirm = screen.getByRole("button", { name: "Save anyway" })
    expect(confirm).toBeDisabled()
    await userEvent.click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("still lets you back out while saving", () => {
    setup({ saving: true })
    expect(screen.getByRole("button", { name: "Keep logging" })).toBeEnabled()
  })
})
