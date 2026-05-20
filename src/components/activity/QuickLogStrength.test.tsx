// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import type { ExerciseDefinition } from "@/data/exercises"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  workoutLogsInsertSingle: vi.fn(),
  exerciseLogsInsertSingle: vi.fn(),
  setLogsInsert: vi.fn(),
  ensureExercisesExist: vi.fn(),
}))

// Supabase chain for QuickLogStrength's mutation:
//   .from("workout_logs").insert(...).select("id").single()
//   .from("exercise_logs").insert(...).select("id").single()
//   .from("set_logs").insert(setRows)  (no chained terminator; awaited)
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === "workout_logs") {
        return {
          insert: () => ({
            select: () => ({ single: mocks.workoutLogsInsertSingle }),
          }),
        }
      }
      if (table === "exercise_logs") {
        return {
          insert: () => ({
            select: () => ({ single: mocks.exerciseLogsInsertSingle }),
          }),
        }
      }
      // set_logs
      return { insert: mocks.setLogsInsert }
    },
  }),
}))

vi.mock("@/lib/supabase/exercises", () => ({
  ensureExercisesExist: mocks.ensureExercisesExist,
}))

// Stub out the full-screen ExercisePicker so we can drive selection from
// the test without rendering its internals.
vi.mock("@/components/activity/exercise-picker", () => ({
  ExercisePicker: ({
    onSelect,
    onClose,
  }: {
    onSelect: (def: ExerciseDefinition) => void
    onClose: () => void
  }) => (
    <div data-testid="exercise-picker">
      <button
        type="button"
        onClick={() =>
          onSelect({
            id: "bench-press",
            name: "Bench Press",
            equipmentId: "bench",
            muscleGroups: ["chest"],
            exerciseType: "strength",
            difficulty: "intermediate",
            defaultSets: 3,
            defaultReps: "8-12",
          })
        }
      >
        Pick Bench Press
      </button>
      <button type="button" onClick={onClose}>
        Cancel Picker
      </button>
    </div>
  ),
}))

import { QuickLogStrength } from "./QuickLogStrength"

beforeEach(() => {
  mocks.getUser.mockReset()
  mocks.workoutLogsInsertSingle
    .mockReset()
    .mockResolvedValue({ data: { id: "wl-1" }, error: null })
  mocks.exerciseLogsInsertSingle
    .mockReset()
    .mockResolvedValue({ data: { id: "el-1" }, error: null })
  mocks.setLogsInsert.mockReset().mockResolvedValue({ error: null })
  mocks.ensureExercisesExist
    .mockReset()
    .mockResolvedValue(new Map([["bench-press", "db-bench-press"]]))
})

afterEach(() => {
  cleanup()
})

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

async function openAndPickExercise() {
  fireEvent.click(screen.getByRole("button", { name: /quick strength/i }))
  await screen.findByRole("dialog")
  fireEvent.click(screen.getByRole("button", { name: /choose exercise/i }))
  fireEvent.click(
    await screen.findByRole("button", { name: /pick bench press/i })
  )
  // Picker closes after selecting.
  await waitFor(() => {
    expect(screen.queryByTestId("exercise-picker")).toBeNull()
  })
}

function getWeightAndRepsInputs() {
  const weightInputs = screen.getAllByPlaceholderText(
    "lbs"
  ) as HTMLInputElement[]
  const repsInputs = screen.getAllByPlaceholderText(
    "reps"
  ) as HTMLInputElement[]
  return { weightInputs, repsInputs }
}

function fillSet(index: number, weight: string, reps: string) {
  const { weightInputs, repsInputs } = getWeightAndRepsInputs()
  fireEvent.change(weightInputs[index], { target: { value: weight } })
  fireEvent.change(repsInputs[index], { target: { value: reps } })
}

describe("QuickLogStrength — trigger and dialog", () => {
  it("renders the trigger button by default and no dialog", () => {
    renderWithClient(<QuickLogStrength />)
    expect(
      screen.getByRole("button", { name: /quick strength/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("opens the dialog when the trigger is clicked", async () => {
    renderWithClient(<QuickLogStrength />)
    fireEvent.click(screen.getByRole("button", { name: /quick strength/i }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    // Before picking, only the Choose Exercise CTA is rendered.
    expect(
      screen.getByRole("button", { name: /choose exercise/i })
    ).toBeInTheDocument()
  })
})

describe("QuickLogStrength — exercise picker integration", () => {
  it("renders sets list with the exercise's defaultSets after picking", async () => {
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()

    // Bench Press has defaultSets=3 in the stub.
    const { weightInputs, repsInputs } = getWeightAndRepsInputs()
    expect(weightInputs.length).toBe(3)
    expect(repsInputs.length).toBe(3)
    expect(screen.getByText(/bench press/i)).toBeInTheDocument()
  })

  it("Add Set adds a new empty row", async () => {
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()

    fireEvent.click(screen.getByRole("button", { name: /add set/i }))
    expect(getWeightAndRepsInputs().weightInputs.length).toBe(4)
  })

  it("Remove Set removes a row but never the last one", async () => {
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()

    const removeButtons = screen.getAllByRole("button", {
      name: /remove set/i,
    })
    fireEvent.click(removeButtons[0])
    expect(getWeightAndRepsInputs().weightInputs.length).toBe(2)

    fireEvent.click(
      screen.getAllByRole("button", { name: /remove set/i })[0]
    )
    expect(getWeightAndRepsInputs().weightInputs.length).toBe(1)

    // Last remaining row's button is disabled.
    const lastRemove = screen.getByRole("button", { name: /remove set/i })
    expect(lastRemove).toBeDisabled()
  })
})

describe("QuickLogStrength — Log It enablement", () => {
  it("disables Log It before an exercise is picked", async () => {
    renderWithClient(<QuickLogStrength />)
    fireEvent.click(screen.getByRole("button", { name: /quick strength/i }))
    await screen.findByRole("dialog")
    expect(screen.getByRole("button", { name: /log it/i })).toBeDisabled()
  })

  it("disables Log It when no set has a valid rep count", async () => {
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()
    expect(screen.getByRole("button", { name: /log it/i })).toBeDisabled()
  })

  it("enables Log It once at least one set has reps > 0", async () => {
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()
    fillSet(0, "100", "10")
    expect(screen.getByRole("button", { name: /log it/i })).toBeEnabled()
  })
})

describe("QuickLogStrength — mutation paths", () => {
  it("writes workout_logs, exercise_logs, then set_logs on a successful save", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()
    fillSet(0, "100", "10")
    fillSet(1, "100", "8")
    fillSet(2, "100", "6")

    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    await waitFor(() => {
      expect(mocks.setLogsInsert).toHaveBeenCalledTimes(1)
    })

    // 3 sets all valid -> 3 rows inserted.
    const setRows = mocks.setLogsInsert.mock.calls[0][0]
    expect(setRows).toHaveLength(3)
    expect(setRows[0]).toMatchObject({
      exercise_log_id: "el-1",
      set_number: 1,
      reps: 10,
      weight: 100,
    })
    expect(setRows[1].set_number).toBe(2)
    expect(setRows[2].set_number).toBe(3)

    expect(mocks.ensureExercisesExist).toHaveBeenCalledWith(
      expect.anything(),
      ["bench-press"]
    )

    // Dialog closes after success.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("only inserts sets that have a parseable rep count", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()
    // First set valid, second blank, third valid.
    fillSet(0, "100", "10")
    fillSet(2, "110", "8")

    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    await waitFor(() => {
      expect(mocks.setLogsInsert).toHaveBeenCalledTimes(1)
    })
    const setRows = mocks.setLogsInsert.mock.calls[0][0]
    expect(setRows).toHaveLength(2)
    // set_number renumbers from the filtered list, not the original index.
    expect(setRows.map((r: { set_number: number }) => r.set_number)).toEqual([
      1, 2,
    ])
  })

  it("stores weight as null when the weight input is blank (bodyweight set)", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()
    fillSet(0, "", "15") // bodyweight push-ups style

    fireEvent.click(screen.getByRole("button", { name: /log it/i }))
    await waitFor(() => {
      expect(mocks.setLogsInsert).toHaveBeenCalledTimes(1)
    })
    expect(mocks.setLogsInsert.mock.calls[0][0][0]).toMatchObject({
      reps: 15,
      weight: null,
    })
  })

  it("shows 'Not authenticated' when there is no user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()
    fillSet(0, "100", "10")

    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    expect(await screen.findByText(/not authenticated/i)).toBeInTheDocument()
    expect(mocks.ensureExercisesExist).not.toHaveBeenCalled()
    expect(mocks.workoutLogsInsertSingle).not.toHaveBeenCalled()
  })

  it("shows an error when ensureExercisesExist can't resolve the exercise", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.ensureExercisesExist.mockResolvedValue(new Map())
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()
    fillSet(0, "100", "10")

    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    expect(
      await screen.findByText(/exercise not found in database/i)
    ).toBeInTheDocument()
    expect(mocks.workoutLogsInsertSingle).not.toHaveBeenCalled()
  })

  it("surfaces a workout_logs insert error to the user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.workoutLogsInsertSingle.mockResolvedValue({
      data: null,
      error: { message: "rls violation" },
    })
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()
    fillSet(0, "100", "10")

    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    expect(await screen.findByText(/rls violation/i)).toBeInTheDocument()
    expect(mocks.exerciseLogsInsertSingle).not.toHaveBeenCalled()
    expect(mocks.setLogsInsert).not.toHaveBeenCalled()
    // Dialog stays open so the user can see the error.
    expect(screen.queryByRole("dialog")).toBeInTheDocument()
  })
})

describe("QuickLogStrength — Cancel", () => {
  it("closes the dialog without saving when Cancel is clicked", async () => {
    renderWithClient(<QuickLogStrength />)
    await openAndPickExercise()
    fillSet(0, "100", "10")

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(mocks.workoutLogsInsertSingle).not.toHaveBeenCalled()
  })
})
