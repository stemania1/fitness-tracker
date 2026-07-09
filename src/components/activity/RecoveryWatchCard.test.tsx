// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import type { DailyMetrics } from "@/lib/sleep-insights"

const realFetch = globalThis.fetch

function mockResponse(data: DailyMetrics[], status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
  }) as unknown as typeof fetch
}

function hrvNights(series: Array<number | null>): DailyMetrics[] {
  return series.map((hrv, i) => ({
    day: `2026-05-${String(i + 1).padStart(2, "0")}`,
    remMinutes: null,
    remFraction: null,
    totalSleepMinutes: null,
    stressHighSeconds: null,
    activityScore: null,
    highActivityMinutes: null,
    readinessScore: null,
    averageHrv: hrv,
  }))
}

import { RecoveryWatchCard } from "./RecoveryWatchCard"

beforeEach(() => {
  mockResponse([])
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

describe("RecoveryWatchCard", () => {
  it("shows the no-HRV empty state when nothing has synced", async () => {
    renderWithClient(<RecoveryWatchCard />)
    expect(await screen.findByText(/no hrv history yet/i)).toBeInTheDocument()
  })

  it("shows an on-track state when recent HRV holds at baseline", async () => {
    mockResponse(hrvNights([...Array(21).fill(60), ...Array(7).fill(60)]))
    renderWithClient(<RecoveryWatchCard />)
    // "on track" appears in both the badge and the message.
    expect((await screen.findAllByText(/on track/i)).length).toBeGreaterThan(0)
    // 7-night and baseline both 60 ms.
    expect(screen.getAllByText("60").length).toBeGreaterThan(0)
  })

  it("flags overreaching for a large sustained HRV drop", async () => {
    mockResponse(hrvNights([...Array(21).fill(60), ...Array(7).fill(51)]))
    renderWithClient(<RecoveryWatchCard />)
    // "overreaching" appears in both the badge and the message.
    expect((await screen.findAllByText(/overreaching/i)).length).toBeGreaterThan(0)
    expect(screen.getByText(/-15%/)).toBeInTheDocument()
    // Sustained low HRV surfaces the non-diagnostic see-a-doctor cue.
    expect(screen.getByText(/worth a doctor visit/i)).toBeInTheDocument()
    expect(screen.getByText(/not a diagnosis/i)).toBeInTheDocument()
  })

  it("does not show the clinician cue at normal HRV, but always shows the emergency note", async () => {
    mockResponse(hrvNights([...Array(21).fill(60), ...Array(7).fill(60)]))
    renderWithClient(<RecoveryWatchCard />)
    await screen.findAllByText(/on track/i)
    expect(screen.queryByText(/worth a doctor visit/i)).toBeNull()
    // Emergency reminder is always present.
    expect(screen.getByText(/call 911/i)).toBeInTheDocument()
  })

  it("shows the building-baseline badge with too little history", async () => {
    mockResponse(hrvNights(Array(10).fill(60)))
    renderWithClient(<RecoveryWatchCard />)
    expect(await screen.findByText(/building baseline/i)).toBeInTheDocument()
  })
})
