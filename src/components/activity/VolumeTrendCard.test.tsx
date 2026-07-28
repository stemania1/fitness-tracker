// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import type { WeeklyVolume, DeloadSuggestion } from "@/lib/volume-trend"

// Mock the hook and the (separately unit-tested) volume-trend lib so this test
// drives the card's render branches deterministically.
const { useStrengthSets } = vi.hoisted(() => ({ useStrengthSets: vi.fn() }))
vi.mock("@/hooks/useStrengthSets", () => ({ useStrengthSets }))

const { buildWeeklyVolumeTrend, shouldSuggestDeload } = vi.hoisted(() => ({
  buildWeeklyVolumeTrend: vi.fn(),
  shouldSuggestDeload: vi.fn(),
}))
vi.mock("@/lib/volume-trend", () => ({ buildWeeklyVolumeTrend, shouldSuggestDeload }))

// The readiness query hits Supabase; stub it so the query resolves harmlessly.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = {}
      b.select = () => b
      b.eq = () => b
      b.not = () => b
      b.order = () => b
      b.limit = () => Promise.resolve({ data: [], error: null })
      return b
    },
  }),
}))

import { VolumeTrendCard } from "./VolumeTrendCard"

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const flat: WeeklyVolume[] = [{ weekLabel: "1/1", volume: 0 }]

afterEach(() => {
  cleanup()
  useStrengthSets.mockReset()
  buildWeeklyVolumeTrend.mockReset()
  shouldSuggestDeload.mockReset()
})

describe("VolumeTrendCard", () => {
  it("shows a skeleton while strength sets are loading", () => {
    useStrengthSets.mockReturnValue({ data: undefined, isLoading: true })
    buildWeeklyVolumeTrend.mockReturnValue(flat)
    shouldSuggestDeload.mockReturnValue(null)
    render(<VolumeTrendCard />, { wrapper })
    expect(screen.getByText("Volume Trend")).toBeInTheDocument()
    expect(screen.queryByText(/log a few strength workouts/i)).toBeNull()
  })

  it("shows the empty state when there is no volume yet", () => {
    useStrengthSets.mockReturnValue({ data: [], isLoading: false })
    buildWeeklyVolumeTrend.mockReturnValue(flat)
    shouldSuggestDeload.mockReturnValue(null)
    render(<VolumeTrendCard />, { wrapper })
    expect(screen.getByText(/log a few strength workouts/i)).toBeInTheDocument()
  })

  it("renders the chart and a low-readiness deload nudge when warranted", () => {
    useStrengthSets.mockReturnValue({
      data: [{ exerciseName: "Squat", weight: 200, reps: 5, startedAt: "x", assisted: false }],
      isLoading: false,
    })
    buildWeeklyVolumeTrend.mockReturnValue([
      { weekLabel: "1/1", volume: 1000 },
      { weekLabel: "1/8", volume: 1200 },
    ])
    const suggestion: DeloadSuggestion = {
      climbPercent: 20,
      weeks: 4,
      lowReadiness: true,
    }
    shouldSuggestDeload.mockReturnValue(suggestion)
    render(<VolumeTrendCard />, { wrapper })
    expect(screen.getByText(/consider a deload week/i)).toBeInTheDocument()
    expect(screen.getByText(/oura readiness is running low/i)).toBeInTheDocument()
    expect(screen.queryByText(/log a few strength workouts/i)).toBeNull()
  })
})
