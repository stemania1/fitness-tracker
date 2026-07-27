// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), workouts: [] as unknown[] }))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ data: mocks.workouts, error: null }),
        }),
      }),
    }),
  }),
}))

import { MuscleBalanceCard } from "./MuscleBalanceCard"

/** A logged exercise with `n` sets of weight×reps, by catalog exercise name. */
function logged(name: string, weight: number, reps: number, n: number) {
  return {
    exercises: { name },
    set_logs: Array.from({ length: n }, () => ({ weight, reps })),
  }
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.workouts = []
})
afterEach(cleanup)

describe("MuscleBalanceCard", () => {
  it("prompts for more data when there's too little logged", async () => {
    mocks.workouts = [
      { started_at: "2026-07-20T12:00:00Z", exercise_logs: [logged("Lat Pulldown", 100, 10, 2)] },
    ]
    render(wrap(<MuscleBalanceCard />))
    expect(
      await screen.findByText(/Log a few more strength sessions/i)
    ).toBeInTheDocument()
  })

  it("flags pressing outpacing pulling", async () => {
    mocks.workouts = [
      {
        started_at: "2026-07-20T12:00:00Z",
        exercise_logs: [
          // Heavy pressing, a token pull, and some legs.
          logged("Chest Press Machine", 100, 10, 6),
          logged("Lat Pulldown", 100, 10, 1),
          logged("Leg Press", 100, 10, 3),
        ],
      },
    ]
    render(wrap(<MuscleBalanceCard />))
    expect(
      await screen.findByText(/add rows or pulldowns/i)
    ).toBeInTheDocument()
  })

  it("names under-trained groups", async () => {
    mocks.workouts = [
      {
        started_at: "2026-07-20T12:00:00Z",
        exercise_logs: [
          logged("Chest Press Machine", 100, 10, 5),
          logged("Lat Pulldown", 100, 10, 5),
        ],
      },
    ]
    render(wrap(<MuscleBalanceCard />))
    // Never trained legs in this window.
    expect(await screen.findByText(/Under-trained:/i)).toBeInTheDocument()
    expect(screen.getByText(/Quads/)).toBeInTheDocument()
  })

  it("ignores sets with no weight or reps", async () => {
    mocks.workouts = [
      {
        started_at: "2026-07-20T12:00:00Z",
        exercise_logs: [
          { exercises: { name: "Plank" }, set_logs: [{ weight: null, reps: null }] },
        ],
      },
    ]
    render(wrap(<MuscleBalanceCard />))
    expect(
      await screen.findByText(/Log a few more strength sessions/i)
    ).toBeInTheDocument()
  })
})
