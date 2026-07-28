// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = {}
      b.select = () => b
      b.eq = () => b
      b.single = () => Promise.resolve({ data: { age: 40 }, error: null })
      return b
    },
  }),
}))

import { OuraSummaryCard } from "./OuraSummaryCard"

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/** Point the mocked fetch at a given /api/oura HTTP response. */
function mockOura(response: {
  ok?: boolean
  status: number
  json?: () => Promise<unknown>
}) {
  ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response)
}

const FULL_SUMMARY = {
  sleep: { score: 85 },
  sleepPeriod: {
    total_sleep_duration: 27000,
    average_hrv: 45,
    lowest_heart_rate: 50,
  },
  readiness: { score: 90, temperature_deviation: 0.3 },
  activity: { active_calories: 500, steps: 8000 },
  restingHeartRate: 55,
  spo2: { spo2_percentage: { average: 97 } },
  stress: { day_summary: "restored", recovery_high: 3600 },
  resilience: { level: "strong" },
  vo2Max: 42.5,
  ringBattery: 80,
  heartRateReadings: [
    { timestamp: "2026-01-05T10:00:00Z", bpm: 70 },
    { timestamp: "2026-01-05T10:05:00Z", bpm: 75 },
  ],
}

const EMPTY_SUMMARY = {
  sleep: null,
  sleepPeriod: null,
  readiness: null,
  activity: null,
  restingHeartRate: null,
  spo2: null,
  stress: null,
  resilience: null,
  vo2Max: null,
  ringBattery: null,
  heartRateReadings: [],
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("OuraSummaryCard", () => {
  it("renders nothing when the ring isn't connected", async () => {
    mockOura({ ok: false, status: 404 })
    const { container } = render(<OuraSummaryCard />, { wrapper })
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByText(/today's oura summary/i)).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it("renders every metric tile when the summary is fully populated", async () => {
    mockOura({ ok: true, status: 200, json: () => Promise.resolve(FULL_SUMMARY) })
    render(<OuraSummaryCard />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText(/today's oura summary/i)).toBeInTheDocument()
    )
    expect(screen.getByText("Sleep")).toBeInTheDocument()
    expect(screen.getByText("Readiness")).toBeInTheDocument()
    expect(screen.getByText("Activity")).toBeInTheDocument()
    expect(screen.getByText("Avg Heart Rate")).toBeInTheDocument()
    expect(screen.getByText("Blood Oxygen")).toBeInTheDocument()
    expect(screen.getByText("Stress")).toBeInTheDocument()
    expect(screen.getByText("Resilience")).toBeInTheDocument()
    expect(screen.getByText("VO2 Max")).toBeInTheDocument()
    // Age is known, so the Zone 2-3 band label renders.
    expect(screen.getByText(/zone 2-3 for you/i)).toBeInTheDocument()
  })

  it("shows the reconnect prompt when the token has expired", async () => {
    mockOura({ ok: false, status: 401 })
    render(<OuraSummaryCard />, { wrapper })
    await waitFor(() =>
      expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
    )
  })

  it("shows a temporary-error message on a failed fetch", async () => {
    mockOura({ ok: false, status: 500 })
    render(<OuraSummaryCard />, { wrapper })
    await waitFor(() =>
      expect(screen.getByText(/unable to fetch oura data/i)).toBeInTheDocument()
    )
  })

  it("shows the no-data-yet state when connected but empty", async () => {
    mockOura({ ok: true, status: 200, json: () => Promise.resolve(EMPTY_SUMMARY) })
    render(<OuraSummaryCard />, { wrapper })
    await waitFor(() =>
      expect(screen.getByText(/no data for today yet/i)).toBeInTheDocument()
    )
  })
})
