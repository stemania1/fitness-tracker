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
import { exercises as exerciseCatalog } from "@/data/exercises"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  workoutLogsInsertSingle: vi.fn(),
  exerciseLogsInsertSingle: vi.fn(),
  setLogsInsert: vi.fn(),
  ensureExercisesExist: vi.fn(),
}))

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
      return { insert: mocks.setLogsInsert }
    },
  }),
}))

vi.mock("@/lib/supabase/exercises", () => ({
  ensureExercisesExist: mocks.ensureExercisesExist,
}))

import { QuickLogExercise } from "./QuickLogExercise"

// The component reads the cardio default from the static catalog at import
// time. Anchor the default we test against.
const defaultCardio = exerciseCatalog.find(
  (e) => e.exerciseType === "cardio"
)!

const bicepCurl = exerciseCatalog.find((e) => e.id === "dumbbell-bicep-curl")!
const pullUp = exerciseCatalog.find((e) => e.id === "pull-up")!

function selectExercise(id: string) {
  const select = document.getElementById("ql-exercise") as HTMLSelectElement
  fireEvent.change(select, { target: { value: id } })
}

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
    .mockResolvedValue(new Map([[defaultCardio.id, "db-cardio-id"]]))
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

async function openDialog() {
  // The trigger button label is exactly "Quick Log" — the strict regex
  // avoids matching the dialog title "Quick Log Exercise".
  fireEvent.click(screen.getByRole("button", { name: /^\s*Quick Log\s*$/i }))
  await screen.findByRole("dialog")
}

function getDurationInput() {
  return screen.getByLabelText(/^minutes$/i) as HTMLInputElement
}

function getSecondsInput() {
  return screen.getByLabelText(/^seconds$/i) as HTMLInputElement
}

describe("QuickLogExercise — trigger and dialog", () => {
  it("renders the trigger button and no dialog by default", () => {
    renderWithClient(<QuickLogExercise />)
    expect(
      screen.getByRole("button", { name: /^\s*Quick Log\s*$/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("opens the dialog when the trigger is clicked", async () => {
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    expect(
      screen.getByText(/log a cardio or strength set/i)
    ).toBeInTheDocument()
    expect(getDurationInput()).toBeInTheDocument()
  })

  it("preselects the first cardio exercise in the catalog", async () => {
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    // The select stores ids as values. /exercise/i would also match the
    // dialog title "Quick Log Exercise", so target the field by its id.
    const select = document.getElementById(
      "ql-exercise"
    ) as HTMLSelectElement | null
    expect(select).not.toBeNull()
    expect(select!.value).toBe(defaultCardio.id)
  })
})

describe("QuickLogExercise — Log It enablement", () => {
  it("disables Log It when the duration field is blank", async () => {
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    expect(screen.getByRole("button", { name: /log it/i })).toBeDisabled()
  })

  it("enables Log It once a duration is typed", async () => {
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    fireEvent.change(getDurationInput(), { target: { value: "30" } })
    expect(screen.getByRole("button", { name: /log it/i })).toBeEnabled()
  })
})

describe("QuickLogExercise — mutation paths", () => {
  it("writes workout_logs -> exercise_logs -> set_logs on a successful save", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    fireEvent.change(getDurationInput(), { target: { value: "30" } })
    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    await waitFor(() => {
      expect(mocks.setLogsInsert).toHaveBeenCalledTimes(1)
    })

    // workout_logs row carries the exercise name, duration, and time math.
    expect(mocks.workoutLogsInsertSingle).toHaveBeenCalledTimes(1)
    // The .insert() call's argument is what's interesting; the stub doesn't
    // capture it, but we can verify the downstream chain results.
    expect(mocks.ensureExercisesExist).toHaveBeenCalledWith(
      expect.anything(),
      [defaultCardio.id]
    )

    // set_logs row uses duration_mins for cardio (no reps/weight).
    expect(mocks.setLogsInsert).toHaveBeenCalledWith({
      exercise_log_id: "el-1",
      set_number: 1,
      duration_mins: 30,
    })

    // Dialog closes on success.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("captures mm:ss duration, distance, and incline for a treadmill run", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    // The default cardio (treadmill-walk) is a treadmill, so the distance and
    // incline fields are visible without changing the exercise.
    renderWithClient(<QuickLogExercise />)
    await openDialog()

    fireEvent.change(getDurationInput(), { target: { value: "10" } })
    fireEvent.change(getSecondsInput(), { target: { value: "45" } })
    fireEvent.change(screen.getByLabelText(/distance/i), {
      target: { value: "1" },
    })
    fireEvent.change(screen.getByLabelText(/incline/i), {
      target: { value: "1" },
    })
    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    await waitFor(() => {
      expect(mocks.setLogsInsert).toHaveBeenCalledTimes(1)
    })

    // 10m 45s -> 10.75 decimal minutes, distance + incline carried through.
    expect(mocks.setLogsInsert).toHaveBeenCalledWith({
      exercise_log_id: "el-1",
      set_number: 1,
      duration_mins: 10.75,
      distance_miles: 1,
      incline_percent: 1,
    })
  })

  it("omits distance and incline when they are left blank", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    fireEvent.change(getDurationInput(), { target: { value: "30" } })
    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    await waitFor(() => {
      expect(mocks.setLogsInsert).toHaveBeenCalledTimes(1)
    })

    expect(mocks.setLogsInsert).toHaveBeenCalledWith({
      exercise_log_id: "el-1",
      set_number: 1,
      duration_mins: 30,
    })
  })

  it("shows 'Not authenticated' when there is no user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    fireEvent.change(getDurationInput(), { target: { value: "20" } })
    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    expect(await screen.findByText(/not authenticated/i)).toBeInTheDocument()
    expect(mocks.ensureExercisesExist).not.toHaveBeenCalled()
  })

  it("shows an error when ensureExercisesExist returns no mapping", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.ensureExercisesExist.mockResolvedValue(new Map())
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    fireEvent.change(getDurationInput(), { target: { value: "20" } })
    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    expect(
      await screen.findByText(/exercise not found in database/i)
    ).toBeInTheDocument()
    expect(mocks.workoutLogsInsertSingle).not.toHaveBeenCalled()
  })

  it("surfaces a workout_logs insert error and skips downstream inserts", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.workoutLogsInsertSingle.mockResolvedValue({
      data: null,
      error: { message: "rls violation" },
    })
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    fireEvent.change(getDurationInput(), { target: { value: "20" } })
    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    expect(await screen.findByText(/rls violation/i)).toBeInTheDocument()
    expect(mocks.exerciseLogsInsertSingle).not.toHaveBeenCalled()
    expect(mocks.setLogsInsert).not.toHaveBeenCalled()
    // Dialog stays open so the user sees the error.
    expect(screen.queryByRole("dialog")).toBeInTheDocument()
  })
})

describe("QuickLogExercise — strength path", () => {
  it("disables Log It for a strength exercise until both sets and reps are set", async () => {
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    selectExercise(bicepCurl.id)

    const logIt = screen.getByRole("button", { name: /log it/i })
    expect(logIt).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/^sets$/i), {
      target: { value: "3" },
    })
    expect(logIt).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/^reps$/i), {
      target: { value: "10" },
    })
    expect(logIt).toBeEnabled()
  })

  it("writes one set_logs row per set with reps and weight", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.ensureExercisesExist.mockResolvedValue(
      new Map([[bicepCurl.id, "db-curl-id"]])
    )
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    selectExercise(bicepCurl.id)

    fireEvent.change(screen.getByLabelText(/^sets$/i), {
      target: { value: "3" },
    })
    fireEvent.change(screen.getByLabelText(/^reps$/i), {
      target: { value: "10" },
    })
    fireEvent.change(screen.getByLabelText(/^weight$/i), {
      target: { value: "25" },
    })
    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    await waitFor(() => {
      expect(mocks.setLogsInsert).toHaveBeenCalledTimes(1)
    })

    expect(mocks.ensureExercisesExist).toHaveBeenCalledWith(
      expect.anything(),
      [bicepCurl.id]
    )
    // 3 sets of 10 reps at 25 lbs -> one row each, sequential set numbers.
    expect(mocks.setLogsInsert).toHaveBeenCalledWith([
      { exercise_log_id: "el-1", set_number: 1, reps: 10, weight: 25 },
      { exercise_log_id: "el-1", set_number: 2, reps: 10, weight: 25 },
      { exercise_log_id: "el-1", set_number: 3, reps: 10, weight: 25 },
    ])

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("omits weight for a bodyweight set like a pull-up", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.ensureExercisesExist.mockResolvedValue(
      new Map([[pullUp.id, "db-pullup-id"]])
    )
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    selectExercise(pullUp.id)

    fireEvent.change(screen.getByLabelText(/^sets$/i), {
      target: { value: "1" },
    })
    fireEvent.change(screen.getByLabelText(/^reps$/i), {
      target: { value: "1" },
    })
    fireEvent.click(screen.getByRole("button", { name: /log it/i }))

    await waitFor(() => {
      expect(mocks.setLogsInsert).toHaveBeenCalledTimes(1)
    })

    expect(mocks.setLogsInsert).toHaveBeenCalledWith([
      { exercise_log_id: "el-1", set_number: 1, reps: 1 },
    ])
  })
})

describe("QuickLogExercise — Cancel", () => {
  it("closes the dialog without saving when Cancel is clicked", async () => {
    renderWithClient(<QuickLogExercise />)
    await openDialog()
    fireEvent.change(getDurationInput(), { target: { value: "20" } })
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(mocks.workoutLogsInsertSingle).not.toHaveBeenCalled()
  })
})
