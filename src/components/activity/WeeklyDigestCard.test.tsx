// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  byTable: {} as Record<string, unknown[]>,
  profile: { current_weight: 200, target_weight: 180 } as Record<string, unknown>,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: mocks.profile, error: null }),
          gte: () =>
            Promise.resolve({ data: mocks.byTable[table] ?? [], error: null }),
        }),
      }),
    }),
  }),
}))

import { WeeklyDigestCard } from "./WeeklyDigestCard"

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, "0")
function isoAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString()
}
function dateAgo(days: number): string {
  const d = new Date(Date.now() - days * DAY)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  // Pin mid-week. The fixtures below are written as "n days ago", and the
  // digest counts from Monday — so on a real Monday every one of them falls
  // into last week and the card correctly reports nothing. The test passed
  // six days out of seven, which is worse than failing.
  //
  // shouldAdvanceTime so React Query's polling still progresses; a frozen
  // clock makes findBy* hang rather than resolve.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 7, 6, 12, 0, 0)) // Thursday 6 Aug, midday

  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.byTable = {}
  mocks.profile = { current_weight: 200, target_weight: 180 }
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("WeeklyDigestCard", () => {
  it("renders all three goal sections and a focus block", async () => {
    // Three workouts this week.
    mocks.byTable.workout_logs = [
      { started_at: isoAgo(1) },
      { started_at: isoAgo(2) },
      { started_at: isoAgo(3) },
    ]
    // A couple of energy check-ins this week.
    mocks.byTable.energy_checkins = [
      { level: 4, logged_on: dateAgo(1) },
      { level: 4, logged_on: dateAgo(2) },
    ]
    render(wrap(<WeeklyDigestCard />))
    expect(await screen.findByText(/3 workouts this week/i)).toBeInTheDocument()
    expect(screen.getByText(/This week's focus/i)).toBeInTheDocument()
    // Weight has no data → learning state.
    expect(
      screen.getByText(/Learning your maintenance calories/i)
    ).toBeInTheDocument()
  })

  it("nudges when no workouts are logged", async () => {
    mocks.byTable.workout_logs = []
    render(wrap(<WeeklyDigestCard />))
    expect(await screen.findByText(/0 workouts this week/i)).toBeInTheDocument()
    expect(screen.getByText(/No workouts logged this week/i)).toBeInTheDocument()
  })

  it("computes a real weight readout with full data", async () => {
    // Workouts this week + last week (exercises both counters).
    mocks.byTable.workout_logs = [
      { started_at: isoAgo(1) },
      { started_at: isoAgo(2) },
      { started_at: isoAgo(3) },
      { started_at: isoAgo(9) },
    ]
    // Energy this week vs last (exercises both averages + delta).
    mocks.byTable.energy_checkins = [
      { level: 4, logged_on: dateAgo(1) },
      { level: 4, logged_on: dateAgo(2) },
      { level: 3, logged_on: dateAgo(9) },
    ]
    // 30 days of weigh-ins losing weight + steady intake → a real TDEE.
    mocks.byTable.weight_logs = Array.from({ length: 30 }, (_, i) => ({
      weight: 200 - (1 / 7) * i,
      logged_at: isoAgo(29 - i),
    }))
    mocks.byTable.food_logs = Array.from({ length: 30 }, (_, i) => ({
      calories: 2000,
      logged_at: isoAgo(29 - i),
    }))
    // Two weeks of sleep for the trend.
    mocks.byTable.oura_daily = Array.from({ length: 14 }, (_, i) => ({
      day: dateAgo(i),
      sleep_score: 80,
      sleep_minutes: 450,
      readiness_score: 70,
    }))

    render(wrap(<WeeklyDigestCard />))
    // Weight section is no longer in the learning state.
    expect(await screen.findByText(/cal\/day maintenance/i)).toBeInTheDocument()
    expect(screen.getByText(/Energy 4\/5 this week/i)).toBeInTheDocument()
  })
})
