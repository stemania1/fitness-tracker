// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  deleteEq: vi.fn(),
  rows: [] as unknown[],
  profile: null as { wake_time: string | null; sleep_goal_hours: number } | null,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            order: () => Promise.resolve({ data: mocks.rows, error: null }),
          }),
          // The bedtime plan behind the late-caffeine cutoff.
          single: () => Promise.resolve({ data: mocks.profile, error: null }),
        }),
      }),
      delete: () => ({ eq: mocks.deleteEq }),
    }),
  }),
}))

import { CaffeineCard } from "./CaffeineCard"

/** An ISO timestamp `minutesAgo` in the past (so it counts toward today). */
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.deleteEq.mockReset().mockResolvedValue({ error: null })
  mocks.rows = []
  mocks.profile = { wake_time: null, sleep_goal_hours: 7.5 }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CaffeineCard />
    </QueryClientProvider>
  )
}

describe("CaffeineCard", () => {
  it("shows an empty state when nothing is logged", async () => {
    renderCard()
    expect(await screen.findByText(/no caffeine logged today/i)).toBeInTheDocument()
  })

  it("shows the day's total vs guideline, drinks, and what's still active", async () => {
    mocks.rows = [
      { id: "c1", mg: 95, source: "Coffee", logged_at: ago(45) },
      { id: "c2", mg: 65, source: "Espresso", logged_at: ago(20) },
    ]
    renderCard()
    expect(await screen.findByText("Coffee")).toBeInTheDocument()
    expect(screen.getByText("Espresso")).toBeInTheDocument()
    expect(screen.getByText("160")).toBeInTheDocument() // total mg
    expect(screen.getByText(/of 400/)).toBeInTheDocument()
    expect(screen.getByText(/still active/i)).toBeInTheDocument()
  })

  it("flags going over the daily guideline", async () => {
    mocks.rows = [
      { id: "c1", mg: 250, source: "Cold brew", logged_at: ago(60) },
      { id: "c2", mg: 200, source: "Energy drink", logged_at: ago(30) },
    ]
    renderCard()
    await screen.findByText("Cold brew")
    expect(screen.getByText(/over the 400 mg daily guideline/i)).toBeInTheDocument()
  })

  // Built from local components on both sides, so the assertion doesn't
  // depend on the timezone the suite happens to run in.
  function atLocalTime(hour: number, minute: number): string {
    return new Date(2026, 6, 31, hour, minute, 0).toISOString()
  }

  describe("late-caffeine warning", () => {
    beforeEach(() => {
      // shouldAdvanceTime, or the query's async resolution never progresses
      // and findBy* polls forever against a frozen clock.
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.setSystemTime(new Date(2026, 6, 31, 16, 0, 0)) // 4pm local
      // 1:45pm — inside the generic 2pm default, past an early riser's cutoff.
      mocks.rows = [
        { id: "c1", mg: 95, source: "Coffee", logged_at: atLocalTime(13, 45) },
      ]
    })

    it("judges against the user's own cutoff, not a generic 2pm", async () => {
      // Up at 5am on a 7.5h goal → 9:30pm bedtime → 1:30pm caffeine cutoff.
      mocks.profile = { wake_time: "05:00", sleep_goal_hours: 7.5 }
      renderCard()
      expect(await screen.findByText(/after 1:30pm/i)).toBeInTheDocument()
    })

    it("falls back to the 2pm default when no wake time is set", async () => {
      mocks.profile = { wake_time: null, sleep_goal_hours: 7.5 }
      renderCard()
      await screen.findByText("Coffee")
      expect(screen.queryByText(/deep sleep/i)).not.toBeInTheDocument()
    })
  })

  it("deletes a drink on a two-tap confirm", async () => {
    mocks.rows = [{ id: "c1", mg: 95, source: "Coffee", logged_at: ago(30) }]
    renderCard()
    await screen.findByText("Coffee")

    fireEvent.click(screen.getByRole("button", { name: /^delete coffee$/i })) // arm
    fireEvent.click(screen.getByRole("button", { name: /confirm delete of coffee/i })) // confirm

    await waitFor(() => expect(mocks.deleteEq).toHaveBeenCalledWith("id", "c1"))
  })
})
