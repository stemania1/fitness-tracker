// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import type { DailyMetrics } from "@/lib/sleep-insights"

const realFetch = globalThis.fetch

function mockMetricsResponse(data: DailyMetrics[], status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
  }) as unknown as typeof fetch
}

function night(over: Partial<DailyMetrics> & { day: string }): DailyMetrics {
  return {
    remMinutes: null,
    remFraction: null,
    totalSleepMinutes: null,
    stressHighSeconds: null,
    activityScore: null,
    highActivityMinutes: null,
    readinessScore: null,
    averageHrv: null,
    ...over,
  }
}

import { RemInsightsCard } from "./RemInsightsCard"

beforeEach(() => {
  mockMetricsResponse([])
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

describe("RemInsightsCard", () => {
  it("shows the empty state when no sleep history exists", async () => {
    renderWithClient(<RemInsightsCard />)
    expect(
      await screen.findByText(/no oura sleep history yet/i)
    ).toBeInTheDocument()
  })

  it("shows average REM and a correlation summary", async () => {
    // Build 5 nights where total sleep and REM% rise together.
    const nights = [
      night({ day: "2026-06-01", remMinutes: 72, remFraction: 0.15, totalSleepMinutes: 360 }),
      night({ day: "2026-06-02", remMinutes: 90, remFraction: 0.18, totalSleepMinutes: 420 }),
      night({ day: "2026-06-03", remMinutes: 108, remFraction: 0.21, totalSleepMinutes: 480 }),
      night({ day: "2026-06-04", remMinutes: 120, remFraction: 0.24, totalSleepMinutes: 540 }),
      night({ day: "2026-06-05", remMinutes: 132, remFraction: 0.27, totalSleepMinutes: 600 }),
    ]
    mockMetricsResponse(nights)

    renderWithClient(<RemInsightsCard />)
    // avg REM% = mean(15,18,21,24,27) = 21
    expect(await screen.findByText(/21%/)).toBeInTheDocument()
    expect(screen.getByText(/avg REM/i)).toBeInTheDocument()
    // "5 nights" appears in the header, correlations, and banner.
    expect(screen.getAllByText(/5 nights/i).length).toBeGreaterThan(0)
    // Total sleep should surface as a strong positive link ("Total sleep"
    // also appears in the honesty banner, hence getAllByText).
    expect(screen.getAllByText(/Total sleep/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/strong link/i)).toBeInTheDocument()
    // Honesty banner is always present.
    expect(screen.getByText(/exploratory only/i)).toBeInTheDocument()
  })

  it("refetches with a new window when the range toggle is clicked", async () => {
    mockMetricsResponse([
      night({ day: "2026-06-01", remMinutes: 90, remFraction: 0.2, totalSleepMinutes: 450 }),
      night({ day: "2026-06-02", remMinutes: 95, remFraction: 0.21, totalSleepMinutes: 460 }),
      night({ day: "2026-06-03", remMinutes: 100, remFraction: 0.22, totalSleepMinutes: 470 }),
    ])
    renderWithClient(<RemInsightsCard />)
    await screen.findByText(/avg REM/i)

    fireEvent.click(screen.getByRole("button", { name: "30d" }))

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      expect(calls.some((c) => String(c[0]).includes("days=30"))).toBe(true)
    })
  })

  it("treats a 404 (Oura not connected) as the empty state", async () => {
    mockMetricsResponse([], 404)
    renderWithClient(<RemInsightsCard />)
    expect(
      await screen.findByText(/no oura sleep history yet/i)
    ).toBeInTheDocument()
  })
})
