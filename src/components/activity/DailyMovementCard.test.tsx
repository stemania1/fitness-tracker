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
  useProfile.mockReturnValue({ data: { daily_step_goal: 8000 } })
  useUserQuery.mockReturnValue({ data: [] })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  useQuery.mockReset()
  useProfile.mockReset()
  useUserQuery.mockReset()
})

describe("DailyMovementCard", () => {
  it("renders nothing when no ring is connected", () => {
    mockOura({ connected: false, activity: null })
    const { container } = render(<DailyMovementCard />, { wrapper })
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the ring is connected but today has no activity", () => {
    mockOura({ connected: true, activity: null })
    const { container } = render(<DailyMovementCard />, { wrapper })
    expect(container).toBeEmptyDOMElement()
  })

  it("shows a skeleton while the summary loads", () => {
    mockOura("loading")
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("Daily Movement")).toBeInTheDocument()
    expect(screen.queryByText(/steps/)).toBeNull()
  })

  it("shows the step total against the goal", () => {
    mockOura({ connected: true, activity: activity(4200) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("4,200")).toBeInTheDocument()
    expect(screen.getByText("/ 8,000 steps")).toBeInTheDocument()
  })

  it("calls a total on schedule on pace", () => {
    // 14:30 is the midpoint, so 4,000 of 8,000 is exactly on time.
    mockOura({ connected: true, activity: activity(4000) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("On pace")).toBeInTheDocument()
    expect(screen.getByText("4,000 steps to go")).toBeInTheDocument()
  })

  it("flags a total well under schedule as behind", () => {
    mockOura({ connected: true, activity: activity(800) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("Behind pace")).toBeInTheDocument()
    expect(screen.getByText(/3,200 behind schedule/)).toBeInTheDocument()
  })

  it("celebrates a met goal", () => {
    mockOura({ connected: true, activity: activity(8600) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("Goal met")).toBeInTheDocument()
    expect(screen.getByText(/goal cleared/)).toBeInTheDocument()
  })

  it("drives the progress bar from the percent, capped at 100", () => {
    mockOura({ connected: true, activity: activity(20000) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    )
  })

  it("uses the default goal when the profile has none", () => {
    useProfile.mockReturnValue({ data: null })
    mockOura({ connected: true, activity: activity(1000) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("/ 8,000 steps")).toBeInTheDocument()
  })

  it("honors a custom step goal", () => {
    useProfile.mockReturnValue({ data: { daily_step_goal: 12000 } })
    mockOura({ connected: true, activity: activity(6000) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("/ 12,000 steps")).toBeInTheDocument()
  })

  it("shows the hourly movement chart with its intensity legend", () => {
    mockOura({ connected: true, activity: activity(4200) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("Movement by hour")).toBeInTheDocument()
    // 12 low + 12 medium samples = 120 minutes of movement.
    expect(screen.getByText("2h active")).toBeInTheDocument()
    expect(screen.getByText("Low")).toBeInTheDocument()
    expect(screen.getByText("Medium")).toBeInTheDocument()
    expect(screen.getByText("High")).toBeInTheDocument()
  })

  it("explains the missing chart when the ring has no intraday data yet", () => {
    mockOura({
      connected: true,
      activity: activity(4200, { class_5_min: null, timestamp: null }),
    })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.queryByText("Movement by hour")).toBeNull()
    expect(screen.getByText(/Hourly movement appears once/)).toBeInTheDocument()
  })

  it("shows the stored weekly average, excluding today's partial total", () => {
    useUserQuery.mockReturnValue({
      data: [
        { day: "2026-08-13", steps: 6000 },
        { day: "2026-08-14", steps: 10000 },
        // Today — partial, and must not drag the average to 5,400.
        { day: "2026-08-15", steps: 200 },
      ],
    })
    mockOura({ connected: true, activity: activity(200) })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.getByText("8,000")).toBeInTheDocument()
    expect(screen.getByText(/1\/2 at goal/)).toBeInTheDocument()
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

  it("stays quiet about a short sitting stretch", () => {
    mockOura({
      connected: true,
      activity: activity(4200, { class_5_min: "3".repeat(24) + "2".repeat(6) }),
    })
    render(<DailyMovementCard />, { wrapper })
    expect(screen.queryByText(/time to move/)).toBeNull()
  })
})
