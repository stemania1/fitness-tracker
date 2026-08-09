// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  table: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => {
  const build = (name: string) => {
    const b = {
      select: () => b,
      eq: () => b,
      gte: () => b,
      order: () => b,
      then: (resolve: (v: unknown) => unknown) =>
        resolve({ data: mocks.table(name) ?? [], error: null }),
    }
    return b
  }
  return {
    createClient: () => ({
      auth: { getUser: mocks.getUser },
      from: (name: string) => build(name),
    }),
  }
})

// Recharts needs a measured container, which jsdom never gives it.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 200 }}>{children}</div>
    ),
  }
})

import { EnergyTrendCard } from "./EnergyTrendCard"

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <EnergyTrendCard />
    </QueryClientProvider>
  )
}

/** Check-ins on consecutive days, all reporting `level`. */
function checkins(count: number, level: number, hour = 10) {
  return Array.from({ length: count }, (_, i) => ({
    level,
    logged_hour: hour,
    logged_on: `2026-08-${String(i + 1).padStart(2, "0")}`,
    created_at: `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
  }))
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.table.mockReset().mockReturnValue([])
})

afterEach(() => cleanup())

describe("EnergyTrendCard", () => {
  it("explains itself rather than drawing an empty chart", async () => {
    renderCard()
    expect(
      await screen.findByText(/two energy check-ins and this starts drawing/i)
    ).toBeInTheDocument()
  })

  it("withholds the chart until there are two points", async () => {
    mocks.table.mockImplementation((t: string) =>
      t === "energy_checkins" ? checkins(1, 3) : []
    )
    renderCard()
    expect(
      await screen.findByText(/two energy check-ins and this starts drawing/i)
    ).toBeInTheDocument()
  })

  it("counts the days by how they landed against the prediction", async () => {
    mocks.table.mockImplementation((t: string) =>
      t === "energy_checkins" ? checkins(8, 1) : []
    )
    renderCard()
    // Feeling 1 against a neutral 3 expectation is 8 days below.
    const count = await screen.findByText("8")
    expect(count.parentElement?.textContent).toMatch(/below/)
  })

  it("says what a persistent gap usually means", async () => {
    mocks.table.mockImplementation((t: string) =>
      t === "energy_checkins" ? checkins(8, 1) : []
    )
    renderCard()
    expect(
      await screen.findByText(/hydration, stress, illness, or under-eating/i)
    ).toBeInTheDocument()
  })

  // Re-picking how you feel inserts a second row for the same day.
  it("keeps one point per day, taking the latest check-in", async () => {
    mocks.table.mockImplementation((t: string) =>
      t === "energy_checkins"
        ? [
            { level: 1, logged_hour: 9, logged_on: "2026-08-01", created_at: "2026-08-01T09:00:00Z" },
            { level: 5, logged_hour: 18, logged_on: "2026-08-01", created_at: "2026-08-01T18:00:00Z" },
            { level: 3, logged_hour: 10, logged_on: "2026-08-02", created_at: "2026-08-02T10:00:00Z" },
          ]
        : []
    )
    renderCard()
    await screen.findByText(/last 60 days/i)
    // Two days, not three: the 5 supersedes the 1 on Aug 1.
    const counts = screen.getAllByText(/^[0-9]+$/).map((el) => el.textContent)
    expect(counts).toContain("1") // one day above (the 5)
  })

  it("is upfront that the expectation is recalculated", async () => {
    mocks.table.mockImplementation((t: string) =>
      t === "energy_checkins" ? checkins(8, 3) : []
    )
    renderCard()
    expect(
      await screen.findByText(/recalculated from each day/i)
    ).toBeInTheDocument()
  })
})
