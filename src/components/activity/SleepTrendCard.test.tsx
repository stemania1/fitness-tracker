// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rows: [] as Array<{
    day: string
    sleep_score: number | null
    sleep_minutes: number | null
    readiness_score: number | null
  }>,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ data: mocks.rows, error: null }),
        }),
      }),
    }),
  }),
}))

import { SleepTrendCard } from "./SleepTrendCard"

const pad = (n: number) => String(n).padStart(2, "0")
function dayStr(offset: number): string {
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
  mocks.rows = []
})
afterEach(cleanup)

describe("SleepTrendCard", () => {
  it("shows a learning state with too little history", async () => {
    mocks.rows = [
      { day: dayStr(1), sleep_score: 80, sleep_minutes: 420, readiness_score: 70 },
    ]
    render(wrap(<SleepTrendCard />))
    expect(
      await screen.findByText(/trends will appear as your Oura history syncs/i)
    ).toBeInTheDocument()
  })

  it("shows the 7-day sleep average with history", async () => {
    mocks.rows = Array.from({ length: 10 }, (_, i) => ({
      day: dayStr(i),
      sleep_score: 80,
      sleep_minutes: 450,
      readiness_score: 70,
    }))
    render(wrap(<SleepTrendCard />))
    expect(await screen.findByText(/Avg sleep \(7-day\)/i)).toBeInTheDocument()
    expect(screen.getByText(/7\.5h/)).toBeInTheDocument()
  })

  it("switches metric when a tab is clicked", async () => {
    mocks.rows = Array.from({ length: 10 }, (_, i) => ({
      day: dayStr(i),
      sleep_score: 80,
      sleep_minutes: 450,
      readiness_score: 66,
    }))
    render(wrap(<SleepTrendCard />))
    await screen.findByText(/Avg sleep \(7-day\)/i)
    fireEvent.click(screen.getByRole("button", { name: "Readiness" }))
    expect(await screen.findByText(/Avg readiness \(7-day\)/i)).toBeInTheDocument()
    expect(screen.getByText("66")).toBeInTheDocument()
  })
})
