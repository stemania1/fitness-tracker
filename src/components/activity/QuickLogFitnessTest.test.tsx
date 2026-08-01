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

// `createClient` is called at module top level inside QuickLogFitnessTest, so
// the mock has to be in place before the import below. vi.hoisted ensures the
// shared fn references exist by the time vi.mock's factory runs.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
}))

// A Cooper test now also writes a workout via saveWorkout, which chains
// .insert().select().single() and resolves catalog ids — so the stub has to
// answer more than a bare insert.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_table: string) => ({
      insert: (row: unknown) => {
        const res = mocks.insert(row)
        return Object.assign(Promise.resolve(res ?? { error: null }), {
          select: () => ({
            single: () =>
              Promise.resolve({ data: { id: "log-1" }, error: null }),
          }),
        })
      },
      select: () => ({
        in: () => Promise.resolve({ data: [], error: null }),
      }),
      upsert: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
}))

vi.mock("@/lib/supabase/exercises", () => ({
  ensureExercisesExist: async (_c: unknown, ids: string[]) =>
    new Map(ids.map((id) => [id, `uuid-${id}`])),
}))

import { QuickLogFitnessTest } from "./QuickLogFitnessTest"
import { resetAuthUserId } from "@/lib/supabase/user-query"

beforeEach(() => {
  // The auth user id is cached for the session; clear it so a test
  // that simulates a signed-out user isn't served the previous id.
  resetAuthUserId()
  mocks.getUser.mockReset()
  mocks.insert.mockReset().mockResolvedValue({ error: null })
})

afterEach(() => {
  cleanup()
})

/** The distance unit defaults to miles; these tests are explicit about it. */
function selectUnit(u: "mi" | "m") {
  fireEvent.click(// A bare string name is an exact match, so "m" does not match "mi".
    screen.getByRole("button", { name: u }))
}

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
  fireEvent.click(screen.getByRole("button", { name: /log test/i }))
  return screen.findByRole("dialog")
}

describe("QuickLogFitnessTest", () => {
  it("renders the trigger button by default and no dialog content", () => {
    renderWithClient(<QuickLogFitnessTest />)
    expect(
      screen.getByRole("button", { name: /log test/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("defaults to the Cooper test with a meters input", async () => {
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
    expect(screen.getByLabelText(/distance covered/i)).toBeInTheDocument()
  })

  it("shows a live VO2 Max preview for a Cooper distance", async () => {
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
    selectUnit("m")
    fireEvent.change(screen.getByLabelText(/distance covered/i), {
      target: { value: "2400" },
    })
    // (2400 - 504.9) / 44.73 = 42.4
    expect(await screen.findByText(/estimated vo2 max/i)).toBeInTheDocument()
    expect(screen.getByText("42.4")).toBeInTheDocument()
  })

  it("accepts the distance in miles and converts it for the estimate", async () => {
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
    // Miles is the default — the app is imperial and treadmills read miles.
    fireEvent.change(screen.getByLabelText(/distance covered/i), {
      target: { value: "1.22" },
    })
    expect(await screen.findByText(/estimated vo2 max/i)).toBeInTheDocument()
    // 1.22 mi = 1963.4 m -> (1963.4 - 504.9) / 44.73 = 32.6
    expect(screen.getByText("32.6")).toBeInTheDocument()
    // The converted value is shown so a mis-set unit is caught before saving.
    expect(screen.getByText(/1963\.4 m/)).toBeInTheDocument()
  })

  it("stores meters even when the distance was typed in miles", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
    fireEvent.change(screen.getByLabelText(/distance covered/i), {
      target: { value: "1.22" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => {
      expect(mocks.insert).toHaveBeenCalled()
    })
    expect(mocks.insert.mock.calls[0][0].result).toBe(1963.4)
  })

  it("switches to a reps input for the pull-up test and clears the value", async () => {
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
    fireEvent.change(screen.getByLabelText(/distance covered/i), {
      target: { value: "2400" },
    })
    fireEvent.click(screen.getByRole("button", { name: /pull-up max/i }))
    const repsInput = screen.getByLabelText(/strict reps/i) as HTMLInputElement
    expect(repsInput.value).toBe("")
    // No VO2 preview for pull-up tests.
    expect(screen.queryByText(/estimated vo2 max/i)).toBeNull()
  })

  it("disables Save while the result is empty", async () => {
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled()
  })

  it("inserts a cooper_run row and closes the dialog on success", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
    selectUnit("m")
    fireEvent.change(screen.getByLabelText(/distance covered/i), {
      target: { value: "2400" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => {
      expect(mocks.insert).toHaveBeenCalled()
    })
    const row = mocks.insert.mock.calls[0][0]
    expect(row.user_id).toBe("user-1")
    expect(row.test_type).toBe("cooper_run")
    expect(row.result).toBe(2400)
    expect(row.tested_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // A Cooper test also lands as a workout, so it counts toward the week's
    // total and doesn't read as a missed session.
    await waitFor(() => {
      const names = mocks.insert.mock.calls.map(
        (c) => (c[0] as { name?: string }).name
      )
      expect(names).toContain("Cooper 12-min test")
    })

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("inserts a pullup_max row with the entered reps", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: /pull-up max/i }))
    fireEvent.change(screen.getByLabelText(/strict reps/i), {
      target: { value: "5" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => {
      expect(mocks.insert).toHaveBeenCalledTimes(1)
    })
    const row = mocks.insert.mock.calls[0][0]
    expect(row.test_type).toBe("pullup_max")
    expect(row.result).toBe(5)

    // Deliberately no companion workout: the pull-up max is the first
    // exercise of a Pull A session that gets logged on its own, so minting a
    // second workout would double-count the day.
    expect(mocks.insert).toHaveBeenCalledTimes(1)
  })

  it("shows 'Not authenticated' when there is no user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
    selectUnit("m")
    fireEvent.change(screen.getByLabelText(/distance covered/i), {
      target: { value: "2400" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    expect(await screen.findByText(/not authenticated/i)).toBeInTheDocument()
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it("surfaces a Supabase insert error and keeps the dialog open", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.insert.mockResolvedValue({ error: { message: "row violates RLS" } })
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
    selectUnit("m")
    fireEvent.change(screen.getByLabelText(/distance covered/i), {
      target: { value: "2400" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    expect(await screen.findByText(/row violates RLS/i)).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeInTheDocument()
  })
})
