// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  byTable: {} as Record<string, unknown[]>,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          gte: () =>
            Promise.resolve({ data: mocks.byTable[table] ?? [], error: null }),
        }),
      }),
    }),
  }),
}))

import { EnergyDriversCard } from "./EnergyDriversCard"

const pad = (n: number) => String(n).padStart(2, "0")
function dateStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.byTable = {}
})
afterEach(cleanup)

describe("EnergyDriversCard", () => {
  it("shows a learning state with too few check-ins", async () => {
    mocks.byTable = {
      energy_checkins: [
        { level: 3, logged_on: dateStr(0) },
        { level: 4, logged_on: dateStr(1) },
      ],
    }
    render(wrap(<EnergyDriversCard />))
    expect(
      await screen.findByText(/Keep logging energy check-ins/i)
    ).toBeInTheDocument()
  })

  it("surfaces a training→energy pattern", async () => {
    // 12 days: even days trained + energy 4, odd days rest + energy 3.
    const energy: Array<{ level: number; logged_on: string }> = []
    const workouts: Array<{ started_at: string }> = []
    for (let i = 0; i < 12; i++) {
      const trained = i % 2 === 0
      energy.push({ level: trained ? 4 : 3, logged_on: dateStr(i) })
      if (trained) workouts.push({ started_at: `${dateStr(i)}T12:00:00` })
    }
    mocks.byTable = { energy_checkins: energy, workout_logs: workouts }
    render(wrap(<EnergyDriversCard />))
    expect(await screen.findByText(/on days you train/i)).toBeInTheDocument()
  })

  it("says no strong patterns when energy is flat", async () => {
    const energy = Array.from({ length: 12 }, (_, i) => ({
      level: 3,
      logged_on: dateStr(i),
    }))
    mocks.byTable = { energy_checkins: energy }
    render(wrap(<EnergyDriversCard />))
    expect(await screen.findByText(/No strong patterns yet/i)).toBeInTheDocument()
  })
})
