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

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_table: string) => ({
      insert: mocks.insert,
    }),
  }),
}))

import { QuickLogFitnessTest } from "./QuickLogFitnessTest"

beforeEach(() => {
  mocks.getUser.mockReset()
  mocks.insert.mockReset().mockResolvedValue({ error: null })
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
    fireEvent.change(screen.getByLabelText(/distance covered/i), {
      target: { value: "2400" },
    })
    // (2400 - 504.9) / 44.73 = 42.4
    expect(await screen.findByText(/estimated vo2 max/i)).toBeInTheDocument()
    expect(screen.getByText("42.4")).toBeInTheDocument()
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
    fireEvent.change(screen.getByLabelText(/distance covered/i), {
      target: { value: "2400" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => {
      expect(mocks.insert).toHaveBeenCalledTimes(1)
    })
    const row = mocks.insert.mock.calls[0][0]
    expect(row.user_id).toBe("user-1")
    expect(row.test_type).toBe("cooper_run")
    expect(row.result).toBe(2400)
    expect(row.tested_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)

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
  })

  it("shows 'Not authenticated' when there is no user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    renderWithClient(<QuickLogFitnessTest />)
    await openDialog()
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
    fireEvent.change(screen.getByLabelText(/distance covered/i), {
      target: { value: "2400" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    expect(await screen.findByText(/row violates RLS/i)).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeInTheDocument()
  })
})
