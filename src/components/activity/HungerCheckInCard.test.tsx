// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

// createClient runs at module top level, so the mock must exist before the
// import below. The select chain terminates in `.order()`.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  order: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    order: (...args: unknown[]) => mocks.order(...args),
  }
  return {
    createClient: () => ({
      auth: { getUser: mocks.getUser },
      from: () => ({ select: () => builder, insert: mocks.insert }),
    }),
  }
})

import { HungerCheckInCard } from "./HungerCheckInCard"
import { HUNGER_LEVELS } from "@/lib/satiety"

/** An ISO timestamp `hours` before now. */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.insert.mockReset().mockResolvedValue({ error: null })
  mocks.order.mockReset().mockResolvedValue({ data: [], error: null })
})

afterEach(() => cleanup())

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("HungerCheckInCard", () => {
  it("asks the question with the shared scale words", async () => {
    renderWithClient(<HungerCheckInCard />)
    expect(await screen.findByText(/how hungry are you right now/i)).toBeInTheDocument()
    for (const level of HUNGER_LEVELS) {
      expect(screen.getByRole("button", { name: level.label })).toBeInTheDocument()
    }
  })

  it("logs on a single tap, with no save step", async () => {
    renderWithClient(<HungerCheckInCard />)
    fireEvent.click(await screen.findByRole("button", { name: "Ravenous" }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.level).toBe(5)
    expect(row.user_id).toBe("u1")
    expect(Number.isNaN(new Date(row.logged_at).getTime())).toBe(false)
  })

  it("reads back what was logged instead of the selector", async () => {
    mocks.order.mockResolvedValue({
      data: [{ id: "h1", level: 4, logged_at: hoursAgo(1) }],
      error: null,
    })
    renderWithClient(<HungerCheckInCard />)

    expect(await screen.findByText(/you logged/i)).toBeInTheDocument()
    expect(screen.getByText("Hungry")).toBeInTheDocument()
    expect(screen.queryByText(/how hungry are you right now/i)).toBeNull()
  })

  it("takes the latest rating when several were logged today", async () => {
    mocks.order.mockResolvedValue({
      data: [
        { id: "h1", level: 1, logged_at: hoursAgo(6) },
        { id: "h2", level: 5, logged_at: hoursAgo(1) },
      ],
      error: null,
    })
    renderWithClient(<HungerCheckInCard />)
    expect(await screen.findByText("Ravenous")).toBeInTheDocument()
  })

  it("can be logged again after an earlier rating", async () => {
    mocks.order.mockResolvedValue({
      data: [{ id: "h1", level: 2, logged_at: hoursAgo(3) }],
      error: null,
    })
    renderWithClient(<HungerCheckInCard />)

    fireEvent.click(await screen.findByRole("button", { name: /log hunger again/i }))
    fireEvent.click(await screen.findByRole("button", { name: "Ravenous" }))
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    expect(mocks.insert.mock.calls[0][0].level).toBe(5)
  })

  // Whether the rating will actually be scored is knowable at tap time, and
  // saying so beats letting a diligently logged day quietly produce nothing.
  it("says the rating counts when the meal gap is comparable", async () => {
    renderWithClient(
      <HungerCheckInCard
        lastMeal={{ description: "Oats", loggedAt: hoursAgo(3) }}
      />
    )
    expect(await screen.findByText(/Oats was 3h ago/)).toBeInTheDocument()
    expect(screen.getByText(/this one counts/i)).toBeInTheDocument()
  })

  it("warns when the meal gap is too short to be comparable", async () => {
    renderWithClient(
      <HungerCheckInCard
        lastMeal={{ description: "Oats", loggedAt: hoursAgo(0.5) }}
      />
    )
    expect(await screen.findByText(/won't be scored/i)).toBeInTheDocument()
  })

  it("warns when the meal gap is too long to be comparable", async () => {
    renderWithClient(
      <HungerCheckInCard
        lastMeal={{ description: "Oats", loggedAt: hoursAgo(9) }}
      />
    )
    expect(await screen.findByText(/won't be scored/i)).toBeInTheDocument()
  })

  it("still takes a rating when no meal has been logged today", async () => {
    renderWithClient(<HungerCheckInCard lastMeal={null} />)
    fireEvent.click(await screen.findByRole("button", { name: "Ready" }))
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
  })

  it("surfaces a failed save and keeps the buttons up", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "network down" } })
    renderWithClient(<HungerCheckInCard />)
    fireEvent.click(await screen.findByRole("button", { name: "Ready" }))

    expect(await screen.findByText(/network down/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ready" })).toBeInTheDocument()
  })
})
