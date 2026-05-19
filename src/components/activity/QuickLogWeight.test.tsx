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

// `createClient` is called at module top level inside QuickLogWeight, so the
// mock has to be in place before the import below. vi.hoisted ensures the
// shared fn references exist by the time vi.mock's factory runs.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  updateEq: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_table: string) => ({
      insert: mocks.insert,
      update: (_values: Record<string, unknown>) => ({ eq: mocks.updateEq }),
    }),
  }),
}))

import { QuickLogWeight } from "./QuickLogWeight"

beforeEach(() => {
  mocks.getUser.mockReset()
  mocks.insert.mockReset().mockResolvedValue({ error: null })
  mocks.updateEq.mockReset().mockResolvedValue({ error: null })
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

async function openDialogAndType(weight: string) {
  fireEvent.click(screen.getByRole("button", { name: /log weight/i }))
  // Use placeholder rather than label text — the dialog title is also "Log
  // Weight", which makes findByLabelText(/weight/i) ambiguous.
  const input = (await screen.findByPlaceholderText(
    /e\.g\. 185/i
  )) as HTMLInputElement
  fireEvent.change(input, { target: { value: weight } })
  return input
}

describe("QuickLogWeight", () => {
  it("renders the trigger button by default and no dialog content", () => {
    renderWithClient(<QuickLogWeight />)
    expect(
      screen.getByRole("button", { name: /log weight/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("opens the dialog when the trigger is clicked", async () => {
    renderWithClient(<QuickLogWeight />)
    fireEvent.click(screen.getByRole("button", { name: /log weight/i }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/e\.g\. 185/i)).toBeInTheDocument()
  })

  it("disables the Save button while the input is empty", async () => {
    renderWithClient(<QuickLogWeight />)
    fireEvent.click(screen.getByRole("button", { name: /log weight/i }))
    const save = await screen.findByRole("button", { name: /^save$/i })
    expect(save).toBeDisabled()
  })

  it("enables Save once a weight is entered", async () => {
    renderWithClient(<QuickLogWeight />)
    await openDialogAndType("185")
    expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled()
  })

  it("writes to weight_logs and user_profiles, then closes the dialog on success", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    renderWithClient(<QuickLogWeight />)
    await openDialogAndType("182.5")
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => {
      expect(mocks.insert).toHaveBeenCalledTimes(1)
    })

    const insertedRow = mocks.insert.mock.calls[0][0]
    expect(insertedRow.user_id).toBe("user-1")
    expect(insertedRow.weight).toBe(182.5)
    expect(typeof insertedRow.logged_at).toBe("string")

    // Profile current_weight is updated to the new value, scoped to the user.
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "user-1")

    // Dialog closes after a successful submit.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("shows 'Not authenticated' when there is no user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    renderWithClient(<QuickLogWeight />)
    await openDialogAndType("180")
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    expect(await screen.findByText(/not authenticated/i)).toBeInTheDocument()
    // Never tried to insert.
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it("surfaces a Supabase insert error to the user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.insert.mockResolvedValue({ error: { message: "row violates RLS" } })
    renderWithClient(<QuickLogWeight />)
    await openDialogAndType("180")
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    expect(await screen.findByText(/row violates RLS/i)).toBeInTheDocument()
    // Profile update is skipped after the insert failure.
    expect(mocks.updateEq).not.toHaveBeenCalled()
    // Dialog stays open so the user can see the error.
    expect(screen.queryByRole("dialog")).toBeInTheDocument()
  })

  it("closes the dialog without saving when Cancel is clicked", async () => {
    renderWithClient(<QuickLogWeight />)
    await openDialogAndType("180")
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
})
