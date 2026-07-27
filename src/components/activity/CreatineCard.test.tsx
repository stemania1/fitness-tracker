// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rows: [] as Array<{ taken_on: string; dose_g: number }>,
  targetG: 5 as number | null,
  upsert: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          // creatine_logs path
          gte: () => ({
            order: () => Promise.resolve({ data: mocks.rows, error: null }),
          }),
          // user_profiles path
          single: () =>
            Promise.resolve({
              data: { creatine_target_g: mocks.targetG },
              error: null,
            }),
        }),
      }),
      upsert: mocks.upsert,
      delete: () => ({
        eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
      _table: table,
    }),
  }),
}))

import { CreatineCard } from "./CreatineCard"

function localToday(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function shift(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.rows = []
  mocks.targetG = 5
  mocks.upsert.mockReset().mockResolvedValue({ error: null })
})
afterEach(cleanup)

describe("CreatineCard", () => {
  it("shows zero progress and dose buttons when nothing is logged", async () => {
    render(wrap(<CreatineCard />))
    expect(await screen.findByText(/\/ 5 g/)).toBeInTheDocument()
    expect(screen.getByText(/5 g to go/)).toBeInTheDocument()
    for (const g of ["+2.5 g", "+5 g", "+10 g"]) {
      expect(screen.getByRole("button", { name: g })).toBeInTheDocument()
    }
  })

  it("tracks partial progress toward a 10 g target", async () => {
    mocks.targetG = 10
    mocks.rows = [{ taken_on: localToday(), dose_g: 5 }]
    render(wrap(<CreatineCard />))
    expect(await screen.findByText(/\/ 10 g/)).toBeInTheDocument()
    expect(screen.getByText(/5 g to go/)).toBeInTheDocument()
    // Not yet met.
    expect(screen.queryByText(/Target hit/)).not.toBeInTheDocument()
  })

  it("marks the target hit once the total reaches it", async () => {
    mocks.targetG = 10
    mocks.rows = [{ taken_on: localToday(), dose_g: 10 }]
    render(wrap(<CreatineCard />))
    expect(await screen.findByText(/Target hit/)).toBeInTheDocument()
  })

  it("adds a dose on top of today's running total", async () => {
    mocks.targetG = 10
    mocks.rows = [{ taken_on: localToday(), dose_g: 5 }]
    render(wrap(<CreatineCard />))
    fireEvent.click(await screen.findByRole("button", { name: "+2.5 g" }))
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalled())
    // 5 already logged + 2.5 added = 7.5
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ dose_g: 7.5 })
  })

  it("counts a multi-day streak", async () => {
    const today = localToday()
    mocks.rows = [
      { taken_on: today, dose_g: 5 },
      { taken_on: shift(today, -1), dose_g: 5 },
      { taken_on: shift(today, -2), dose_g: 5 },
    ]
    render(wrap(<CreatineCard />))
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument())
    expect(screen.getByText(/days in a row/)).toBeInTheDocument()
  })

  it("falls back to the default target when the profile has none", async () => {
    mocks.targetG = null
    render(wrap(<CreatineCard />))
    expect(await screen.findByText(/\/ 5 g/)).toBeInTheDocument()
  })
})
