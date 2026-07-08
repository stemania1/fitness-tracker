// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  order: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({ order: mocks.order }),
      }),
      insert: vi.fn(),
    }),
  }),
}))

import { Vo2MaxTrendCard } from "./Vo2MaxTrendCard"

const realFetch = globalThis.fetch

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.order.mockReset().mockResolvedValue({ data: [], error: null })
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  }) as unknown as typeof fetch
})

afterEach(() => {
  cleanup()
  globalThis.fetch = realFetch
})

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe("Vo2MaxTrendCard", () => {
  it("shows the empty state when no tests or Oura data exist", async () => {
    renderWithClient(<Vo2MaxTrendCard />)
    expect(
      await screen.findByText(/no fitness tests logged yet/i)
    ).toBeInTheDocument()
  })

  it("shows the latest VO2 value with an age/sex rating badge", async () => {
    // 2400 m Cooper → 42.4 ml/kg/min; excellent cutoff for male 40-49 is 46,
    // low is 32 → "Average".
    mocks.order.mockResolvedValue({
      data: [
        { test_type: "cooper_run", result: 2400, tested_at: "2026-07-12" },
      ],
      error: null,
    })

    renderWithClient(<Vo2MaxTrendCard age={45} sex="male" />)
    expect(await screen.findByText("42.4")).toBeInTheDocument()
    expect(screen.getByText(/average/i)).toBeInTheDocument()
  })

  it("shows a FRIEND percentile for a bracket with reference data", async () => {
    // 2600 m Cooper → 46.8 ml/kg/min. FRIEND men 50-59: 90th=45.6, 95th=50.7
    // → 91st percentile → "top 9%".
    mocks.order.mockResolvedValue({
      data: [
        { test_type: "cooper_run", result: 2600, tested_at: "2026-07-12" },
      ],
      error: null,
    })

    renderWithClient(<Vo2MaxTrendCard age={51} sex="male" />)
    expect(await screen.findByText("46.8")).toBeInTheDocument()
    expect(screen.getByText(/top 9% for your age & sex/i)).toBeInTheDocument()
  })

  it("omits the percentile line for brackets without reference data", async () => {
    mocks.order.mockResolvedValue({
      data: [
        { test_type: "cooper_run", result: 2400, tested_at: "2026-07-12" },
      ],
      error: null,
    })

    renderWithClient(<Vo2MaxTrendCard age={51} sex="female" />)
    expect(await screen.findByText("42.4")).toBeInTheDocument()
    expect(screen.queryByText(/for your age & sex/i)).toBeNull()
  })

  it("prefers the most recent value across sources for the headline stat", async () => {
    mocks.order.mockResolvedValue({
      data: [
        { test_type: "cooper_run", result: 2400, tested_at: "2026-07-12" },
      ],
      error: null,
    })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ day: "2026-08-01", vo2_max: 44.8 }],
      }),
    }) as unknown as typeof fetch

    renderWithClient(<Vo2MaxTrendCard />)
    expect(await screen.findByText("44.8")).toBeInTheDocument()
  })

  it("shows the latest pull-up max beside the chart", async () => {
    mocks.order.mockResolvedValue({
      data: [
        { test_type: "pullup_max", result: 3, tested_at: "2026-07-11" },
        { test_type: "pullup_max", result: 6, tested_at: "2026-08-15" },
      ],
      error: null,
    })

    renderWithClient(<Vo2MaxTrendCard />)
    expect(await screen.findByText(/pull-up max/i)).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
  })

  it("tolerates an Oura fetch failure (renders tests only)", async () => {
    mocks.order.mockResolvedValue({
      data: [
        { test_type: "cooper_run", result: 2600, tested_at: "2026-07-12" },
      ],
      error: null,
    })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Oura not connected" }),
    }) as unknown as typeof fetch

    renderWithClient(<Vo2MaxTrendCard />)
    // (2600 - 504.9) / 44.73 = 46.8
    expect(await screen.findByText("46.8")).toBeInTheDocument()
  })
})
