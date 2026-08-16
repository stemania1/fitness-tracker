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

const mocks = vi.hoisted(() => ({ upsert: vi.fn() }))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: (
        values: Record<string, unknown>,
        options: Record<string, unknown>
      ) => {
        mocks.upsert(values, options)
        return Promise.resolve({ error: null })
      },
    }),
  }),
}))

vi.mock("@/lib/supabase/user-query", () => ({
  getAuthUserId: () => Promise.resolve("user-1"),
}))

// Pin "today" at the date helpers rather than with fake timers: waitFor polls
// on real timers, and faking them here deadlocks every async assertion.
vi.mock("@/lib/dates", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dates")>(
    "@/lib/dates"
  )
  return { ...actual, localToday: () => "2026-08-15" }
})

import { QuickLogSteps } from "./QuickLogSteps"

function renderChip() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <QuickLogSteps />
    </QueryClientProvider>
  )
}

/** Open the dialog and return the two number inputs. */
function open() {
  fireEvent.click(screen.getByRole("button", { name: /log steps/i }))
  return {
    steps: screen.getByLabelText(/^steps$/i),
    minutes: screen.getByLabelText(/active minutes/i),
    save: screen.getByRole("button", { name: /^save$/i }),
  }
}

beforeEach(() => {
  mocks.upsert.mockReset()
})

afterEach(() => {
  cleanup()
})

describe("QuickLogSteps", () => {
  it("saves steps for today, upserting on the day", async () => {
    renderChip()
    const { steps, save } = open()
    fireEvent.change(steps, { target: { value: "7500" } })
    fireEvent.click(save)

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1))
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        day: "2026-08-15",
        steps: 7500,
        active_minutes: null,
      },
      { onConflict: "user_id,day" }
    )
  })

  it("saves both figures when both are given", async () => {
    renderChip()
    const { steps, minutes, save } = open()
    fireEvent.change(steps, { target: { value: "9000" } })
    fireEvent.change(minutes, { target: { value: "45" } })
    fireEvent.click(save)

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1))
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({
      steps: 9000,
      active_minutes: 45,
    })
  })

  it("accepts active minutes alone", async () => {
    renderChip()
    const { minutes, save } = open()
    fireEvent.change(minutes, { target: { value: "30" } })
    fireEvent.click(save)

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1))
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({
      steps: null,
      active_minutes: 30,
    })
  })

  it("logs against yesterday when chosen", async () => {
    renderChip()
    const { steps, save } = open()
    fireEvent.click(screen.getByRole("button", { name: /yesterday/i }))
    fireEvent.change(steps, { target: { value: "6000" } })
    fireEvent.click(save)

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledTimes(1))
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ day: "2026-08-14" })
  })

  it("cannot be submitted empty", () => {
    renderChip()
    const { save } = open()
    expect(save).toBeDisabled()
  })

  // Negative counts are stopped by the inputs' own range constraints — the
  // browser refuses to submit the form, so the mutation's matching guard is
  // never reached from the UI and can't be asserted through it. That guard
  // stays as defense against a programmatic call; this pins the constraint
  // that actually does the work.
  it("constrains both fields to sane ranges", () => {
    renderChip()
    const { steps, minutes } = open()
    expect(steps).toHaveAttribute("min", "0")
    expect(steps).toHaveAttribute("max", "200000")
    expect(minutes).toHaveAttribute("min", "0")
    expect(minutes).toHaveAttribute("max", "1440")
  })

  it("does not submit a negative count", async () => {
    renderChip()
    const { steps, save } = open()
    fireEvent.change(steps, { target: { value: "-5" } })
    fireEvent.click(save)

    await waitFor(() => expect(steps).toBeInvalid())
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it("says the ring wins, so the fallback isn't read as an override", () => {
    renderChip()
    open()
    expect(screen.getByText(/ring data always wins/i)).toBeInTheDocument()
  })
})
