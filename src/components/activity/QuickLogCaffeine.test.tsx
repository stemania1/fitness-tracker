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

import { QuickLogCaffeine } from "./QuickLogCaffeine"

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
  fireEvent.click(screen.getByRole("button", { name: /log caffeine/i }))
  return screen.findByRole("dialog")
}

describe("QuickLogCaffeine", () => {
  it("renders the trigger and no dialog by default", () => {
    renderWithClient(<QuickLogCaffeine />)
    expect(screen.getByRole("button", { name: /log caffeine/i })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("defaults to Coffee at 95mg", async () => {
    renderWithClient(<QuickLogCaffeine />)
    await openDialog()
    const mgInput = screen.getByLabelText(/caffeine \(mg\)/i) as HTMLInputElement
    expect(mgInput.value).toBe("95")
  })

  it("sets mg when a preset is chosen", async () => {
    renderWithClient(<QuickLogCaffeine />)
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: /espresso/i }))
    const mgInput = screen.getByLabelText(/caffeine \(mg\)/i) as HTMLInputElement
    expect(mgInput.value).toBe("65")
  })

  it("inserts a caffeine_logs row with mg, source, and a timestamp", async () => {
    renderWithClient(<QuickLogCaffeine />)
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: /cold brew/i })) // 155mg
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.user_id).toBe("u1")
    expect(row.mg).toBe(155)
    expect(row.source).toBe("Cold brew")
    expect(typeof row.logged_at).toBe("string")
    expect(Number.isNaN(Date.parse(row.logged_at))).toBe(false)
  })

  it("clears the source label when mg is manually edited", async () => {
    renderWithClient(<QuickLogCaffeine />)
    await openDialog()
    fireEvent.change(screen.getByLabelText(/caffeine \(mg\)/i), {
      target: { value: "200" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.mg).toBe(200)
    expect(row.source).toBeNull()
  })

  it("shows an insert error and keeps the dialog open", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "row violates RLS" } })
    renderWithClient(<QuickLogCaffeine />)
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))
    expect(await screen.findByText(/row violates RLS/i)).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeInTheDocument()
  })
})
