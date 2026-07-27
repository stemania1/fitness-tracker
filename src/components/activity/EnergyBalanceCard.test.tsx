// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: { current_weight: 200, target_weight: 180 } as {
    current_weight: number | null
    target_weight: number | null
  },
  weights: [] as Array<{ weight: number; logged_at: string }>,
  foods: [] as Array<{ calories: number; logged_at: string }>,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: mocks.profile, error: null }),
          gte: () =>
            Promise.resolve({
              data: table === "weight_logs" ? mocks.weights : mocks.foods,
              error: null,
            }),
        }),
      }),
    }),
  }),
}))

import { EnergyBalanceCard } from "./EnergyBalanceCard"

const DAY = 86_400_000

/** N consecutive daily weigh-ins ending today, losing `lbPerWeek`. */
function makeWeights(startWeight: number, lbPerWeek: number, n: number) {
  const base = Date.now() - (n - 1) * DAY
  return Array.from({ length: n }, (_, i) => ({
    // Older days heavier, so the trend slopes down toward today.
    weight: startWeight - (lbPerWeek / 7) * i,
    logged_at: new Date(base + i * DAY).toISOString(),
  }))
}

function makeFoods(cals: number, n: number) {
  const base = Date.now() - (n - 1) * DAY
  return Array.from({ length: n }, (_, i) => ({
    calories: cals,
    logged_at: new Date(base + i * DAY).toISOString(),
  }))
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.profile = { current_weight: 200, target_weight: 180 }
  mocks.weights = []
  mocks.foods = []
})
afterEach(cleanup)

describe("EnergyBalanceCard", () => {
  it("shows a learning state without enough data", async () => {
    mocks.weights = makeWeights(200, 1, 4)
    mocks.foods = makeFoods(2000, 4)
    render(wrap(<EnergyBalanceCard />))
    expect(
      await screen.findByText(/Learning your metabolism/i)
    ).toBeInTheDocument()
  })

  it("shows maintenance, trend, and a recommended target", async () => {
    mocks.weights = makeWeights(200, 1, 30) // losing ~1 lb/week
    mocks.foods = makeFoods(2000, 30)
    render(wrap(<EnergyBalanceCard />))
    // TDEE ≈ 2000 − (−1/7 lb/day × 3500) = 2500.
    expect(await screen.findByText(/2,500/)).toBeInTheDocument()
    expect(screen.getByText(/Losing/i)).toBeInTheDocument()
    expect(screen.getByText(/Aim for ~2,000 cal\/day/i)).toBeInTheDocument()
  })

  it("says maintenance holds when already at goal weight", async () => {
    mocks.profile = { current_weight: 180, target_weight: 180 }
    mocks.weights = makeWeights(180, 0, 30) // stable
    mocks.foods = makeFoods(2200, 30)
    render(wrap(<EnergyBalanceCard />))
    expect(await screen.findByText(/holds it/i)).toBeInTheDocument()
  })
})
