// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import type { OuraDailyActivity } from "@/lib/oura"

// Recharts measures its container, which jsdom reports as 0×0 — the chart
// body then renders nothing. Stub the responsive wrapper to a fixed box so
// the series actually mounts and the legend/labels are assertable.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 128 }}>{children}</div>
    ),
  }
})

const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }))
vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>(
      "@tanstack/react-query"
    )
  return { ...actual, useQuery }
})

const { useProfile } = vi.hoisted(() => ({ useProfile: vi.fn() }))
vi.mock("@/hooks/useProfile", () => ({ useProfile }))

const { useUserQuery } = vi.hoisted(() => ({ useUserQuery: vi.fn() }))
vi.mock("@/lib/supabase/user-query", () => ({
  useUserQuery,
  getAuthUserId: vi.fn(),
}))

const { useMovementHistory } = vi.hoisted(() => ({
  useMovementHistory: vi.fn(),
}))
vi.mock("@/hooks/useMovementHistory", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/useMovementHistory")
  >("@/hooks/useMovementHistory")
  return { ...actual, useMovementHistory }
})

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }))

import { DailyMovementCard } from "./DailyMovementCard"

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/** An Oura activity document. `class_5_min` starts at 07:00 local. */
function activity(
  steps: number,
  overrides: Partial<OuraDailyActivity> = {}
): OuraDailyActivity {
  return {
    id: "a1",
    day: "2026-08-15",
    score: 82,
    active_calories: 430,
    total_calories: 2400,
    steps,
    equivalent_walking_distance: 5200,
    high_activity_time: 0,
    medium_activity_time: 1200,
    low_activity_time: 4800,
    class_5_min: "3".repeat(12) + "4".repeat(12),
    timestamp: "2026-08-15T07:00:00-07:00",
    ...overrides,
  }
}

function mockOura(
  value: { connected: boolean; activity: OuraDailyActivity | null } | "loading"
) {
  if (value === "loading") {
    useQuery.mockReturnValue({ data: undefined, isLoading: true })
    return
  }
  useQuery.mockReturnValue({
    data: {
      connected: value.connected,
      summary: value.connected ? { activity: value.activity } : null,
    },
    isLoading: false,
  })
}

beforeEach(() => {
  // Freeze the clock at 14:30 — the exact midpoint of the 07:00-22:00 moving
  // day, so "expected by now" is half the goal and pacing is predictable.
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-08-15T14:30:00"))
  useProfile.mockReturnValue({
    data: { daily_step_goal: 8000, daily_active_minutes_goal: 30 },
  })
  useMovementHistory.mockReturnValue({ data: { ring: [] } })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  useQuery.mockReset()
  useProfile.mockReset()
  useUserQuery.mockReset()
  useMovementHistory.mockReset()
})

describe("DailyMovementCard", () => {
  it("renders nothing when no ring is connected", () => {
    mockOura({ connected: false, activity: null })
    const { container } = render(<DailyMovementCard />, { wrapper })
    expect(container).toBeEmptyDOMElement()
  })

  // The card used to return null here, so a day off the charger deleted the
  // whole Movement section without a word — indistinguishable from a bug.
  it("asks for a number when the ring is connected but reported nothing", () => {
    mockOura({ connected: true, activity: null })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("Daily Movement")).toBeInTheDocument()
    expect(screen.getByText("No movement data for today yet.")).toBeInTheDocument()
    expect(screen.getByText(/hasn't reported today's activity/i)).toBeInTheDocument()
  })

  it("shows the hourly movement chart with its intensity legend", () => {
    mockOura({ connected: true, activity: activity(4200) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("Movement by hour")).toBeInTheDocument()
    // 12 low + 12 medium samples = 120 minutes of movement. Labelled
    // "moving", not "active" — it includes the low band.
    expect(screen.getByText("2h moving")).toBeInTheDocument()
    expect(screen.getByText("Light")).toBeInTheDocument()
    expect(screen.getByText("Moderate")).toBeInTheDocument()
    expect(screen.getByText("Vigorous")).toBeInTheDocument()
  })

  it("explains the missing chart when the ring has no intraday data yet", () => {
    mockOura({
      connected: true,
      activity: activity(4200, { class_5_min: null, timestamp: null, met: null }),
    })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.queryByText("Movement by hour")).toBeNull()
    expect(screen.getByText(/Hourly movement appears once/)).toBeInTheDocument()
  })

  it("shows the stored weekly average, excluding today's partial total", () => {
    useMovementHistory.mockReturnValue({
      data: {
        ring: [
          // Minutes deliberately both above goal, so the "1/2 at goal" below
          // can only be the step line.
          { day: "2026-08-13", steps: 6000, active_minutes: 40 },
          { day: "2026-08-14", steps: 10000, active_minutes: 50 },
          // Today — partial, and must not drag the average to 5,400.
          { day: "2026-08-15", steps: 200, active_minutes: 2 },
        ],
      },
    })
    mockOura({ connected: true, activity: activity(200) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("8,000")).toBeInTheDocument()
    expect(screen.getByText(/1\/2 at goal/)).toBeInTheDocument()
  })

  it("shows a separate weekly average for moderate+ minutes", () => {
    useMovementHistory.mockReturnValue({
      data: {
        ring: [
          { day: "2026-08-13", steps: 6000, active_minutes: 20 },
          { day: "2026-08-14", steps: 10000, active_minutes: 40 },
          { day: "2026-08-15", steps: 200, active_minutes: 2 },
        ],
      },
    })
    mockOura({ connected: true, activity: activity(200) })
    render(<DailyMovementCard />, { wrapper })
    // (20 + 40) / 2, today excluded — one of the two cleared the 30 goal.
    expect(screen.getByText("30 min/day")).toBeInTheDocument()
  })

  it("omits the trend line when there is no stored history", () => {
    mockOura({ connected: true, activity: activity(4200) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.queryByText(/day avg/)).toBeNull()
  })

  it("nudges after a long unbroken sitting stretch", () => {
    mockOura({
      connected: true,
      // Two hours of movement, then two hours of sitting.
      activity: activity(4200, { class_5_min: "3".repeat(24) + "2".repeat(24) }),
    })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText(/Sitting 2h — time to move/)).toBeInTheDocument()
  })

  it("does not tell you to get up right after you got up", () => {
    // Eight hours of sleep, checked at 07:30. Neither source can tell
    // sleeping from sitting, so an unbounded trailing run reads the whole
    // night as one long sit and nags the moment the app is opened.
    vi.setSystemTime(new Date("2026-08-15T07:30:00"))
    mockOura({
      connected: true,
      activity: activity(400, {
        met: {
          interval: 60,
          items: Array(480).fill(0.9),
          timestamp: "2026-08-15T04:00:00-07:00",
        },
      }),
    })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.queryByText(/time to move/)).toBeNull()
  })

  it("stays quiet about a short sitting stretch", () => {
    mockOura({
      connected: true,
      activity: activity(4200, { class_5_min: "3".repeat(24) + "2".repeat(6) }),
    })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.queryByText(/time to move/)).toBeNull()
  })
})
