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
import { CAFFEINE_PRESETS } from "@/lib/caffeine"

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

  it("defaults to the first — most-used — preset", async () => {
    // Asserted against the list rather than a literal, so reordering the
    // presets moves the expectation with the default instead of failing here.
    renderWithClient(<QuickLogCaffeine />)
    await openDialog()
    const mgInput = screen.getByLabelText(/caffeine \(mg\)/i) as HTMLInputElement
    expect(mgInput.value).toBe(String(CAFFEINE_PRESETS[0].mg))
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

  it("backdates the drink to yesterday when the Yesterday chip is used", async () => {
    renderWithClient(<QuickLogCaffeine />)
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: /^yesterday$/i }))
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const logged = new Date(mocks.insert.mock.calls[0][0].logged_at)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(logged.toDateString()).toBe(yesterday.toDateString())
  })

  describe("naming the drink", () => {
    it("sizes a soda properly instead of assuming a 12 oz can", async () => {
      renderWithClient(<QuickLogCaffeine />)
      await openDialog()
      fireEvent.change(screen.getByLabelText(/or name it/i), {
        target: { value: "32 oz Dr Pepper" },
      })

      // The "Soda" preset would have logged 40mg — a third of the real dose.
      expect(screen.getByLabelText(/caffeine \(mg\)/i)).toHaveValue(109)
      expect(screen.getByText(/typical for dr pepper at 32 oz/i)).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: /^save$/i }))
      await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
      const row = mocks.insert.mock.calls[0][0]
      expect(row.mg).toBe(109)
      expect(row.source).toBe("32 oz Dr Pepper")
    })

    it("keeps a typed name as the source when mg is hand-corrected", async () => {
      renderWithClient(<QuickLogCaffeine />)
      await openDialog()
      fireEvent.change(screen.getByLabelText(/or name it/i), {
        target: { value: "office pour-over" },
      })
      fireEvent.change(screen.getByLabelText(/caffeine \(mg\)/i), {
        target: { value: "120" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

      await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
      const row = mocks.insert.mock.calls[0][0]
      expect(row.mg).toBe(120)
      // Unlike a preset, a name the user typed survives editing the number.
      expect(row.source).toBe("office pour-over")
    })

    it("says a caffeine-free drink has nothing to log, and blocks saving", async () => {
      renderWithClient(<QuickLogCaffeine />)
      await openDialog()
      fireEvent.change(screen.getByLabelText(/or name it/i), {
        target: { value: "Sprite" },
      })

      expect(screen.getByText(/has no caffeine — nothing to log/i)).toBeInTheDocument()
      // caffeine_logs requires mg > 0, so there is no row to write.
      expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled()
    })

    it("leaves the mg alone for a drink it doesn't recognize", async () => {
      renderWithClient(<QuickLogCaffeine />)
      await openDialog()
      fireEvent.change(screen.getByLabelText(/or name it/i), {
        target: { value: "yerba mate gourd" },
      })
      // Still the default preset's value — no guessing at an unknown drink.
      expect(screen.getByLabelText(/caffeine \(mg\)/i)).toHaveValue(
        CAFFEINE_PRESETS[0].mg
      )
    })

    it("tapping a preset clears a typed name", async () => {
      renderWithClient(<QuickLogCaffeine />)
      await openDialog()
      fireEvent.change(screen.getByLabelText(/or name it/i), {
        target: { value: "32 oz Dr Pepper" },
      })
      fireEvent.click(screen.getByRole("button", { name: /espresso/i }))
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

      await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
      expect(mocks.insert.mock.calls[0][0].source).toBe("Espresso")
    })
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
