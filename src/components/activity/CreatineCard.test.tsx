// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rows: [] as Array<{ taken_on: string; dose_g: number }>,
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
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
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
})
afterEach(cleanup)

describe("CreatineCard", () => {
  it("shows Mark taken and a zero streak when nothing is logged", async () => {
    render(wrap(<CreatineCard />))
    expect(await screen.findByText("Mark taken")).toBeInTheDocument()
    expect(screen.getByText("Not logged yet today")).toBeInTheDocument()
  })

  it("shows Done and the dose when taken today", async () => {
    const today = localToday()
    mocks.rows = [{ taken_on: today, dose_g: 5 }]
    render(wrap(<CreatineCard />))
    expect(await screen.findByText("Done")).toBeInTheDocument()
    expect(screen.getByText(/Taken today · 5 g/)).toBeInTheDocument()
  })

  it("counts a multi-day streak and pluralizes", async () => {
    const today = localToday()
    mocks.rows = [
      { taken_on: today, dose_g: 5 },
      { taken_on: shift(today, -1), dose_g: 5 },
      { taken_on: shift(today, -2), dose_g: 5 },
    ]
    render(wrap(<CreatineCard />))
    await waitFor(() =>
      expect(screen.getByText("3")).toBeInTheDocument()
    )
    expect(screen.getByText("days in a row")).toBeInTheDocument()
  })

  it("uses the singular 'day' for a one-day streak", async () => {
    const today = localToday()
    mocks.rows = [{ taken_on: today, dose_g: 5 }]
    render(wrap(<CreatineCard />))
    await waitFor(() =>
      expect(screen.getByText("day in a row")).toBeInTheDocument()
    )
  })
})
