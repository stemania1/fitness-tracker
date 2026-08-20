// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ insert: mocks.insert }),
  }),
}))

import { QuickLogHunger } from "./QuickLogHunger"
import { HUNGER_LEVELS } from "@/lib/satiety"

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.insert.mockReset().mockResolvedValue({ error: null })
})

afterEach(() => cleanup())

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /log hunger/i }))
  return screen.findByRole("dialog")
}

const save = () => screen.getByRole("button", { name: /^save$/i })

describe("QuickLogHunger", () => {
  it("renders the trigger and no dialog by default", () => {
    renderWithClient(<QuickLogHunger />)
    expect(screen.getByRole("button", { name: /log hunger/i })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("offers the same scale words the meal logger uses", async () => {
    renderWithClient(<QuickLogHunger />)
    await openDialog()
    // Two screens wording the question differently would produce two
    // incomparable columns that the analysis then averages together.
    for (const level of HUNGER_LEVELS) {
      expect(screen.getByRole("button", { name: level.label })).toBeInTheDocument()
    }
  })

  it("logs the chosen level with a timestamp", async () => {
    renderWithClient(<QuickLogHunger />)
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: "Ravenous" }))
    fireEvent.click(save())

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.level).toBe(5)
    expect(row.user_id).toBe("u1")
    // A date, not a day: the whole value is in when the hunger arrived.
    expect(Number.isNaN(new Date(row.logged_at).getTime())).toBe(false)
  })

  it("cannot be saved without a level", async () => {
    renderWithClient(<QuickLogHunger />)
    await openDialog()
    // No sensible default exists — a prefilled "Ready" would be recorded as
    // a real answer for anyone who opened the dialog and tapped Save.
    expect(save()).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Hungry" }))
    expect(save()).toBeEnabled()
  })

  it("keeps one level selected at a time, and lets it be cleared", async () => {
    renderWithClient(<QuickLogHunger />)
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: "Still full" }))
    fireEvent.click(screen.getByRole("button", { name: "Hungry" }))
    expect(screen.getByRole("button", { name: "Still full" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )

    fireEvent.click(screen.getByRole("button", { name: "Hungry" }))
    expect(screen.getByRole("button", { name: "Hungry" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    expect(save()).toBeDisabled()
  })

  it("starts blank the next time it opens", async () => {
    renderWithClient(<QuickLogHunger />)
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: "Ravenous" }))
    fireEvent.click(save())
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))

    // A level carried over from the last log would be recorded as a fresh
    // answer for this one.
    await openDialog()
    expect(screen.getByRole("button", { name: "Ravenous" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    expect(save()).toBeDisabled()
  })

  it("surfaces a failed save instead of closing", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "network down" } })
    renderWithClient(<QuickLogHunger />)
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: "Ready" }))
    fireEvent.click(save())

    expect(await screen.findByText(/network down/i)).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})
