// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: {} as Record<string, unknown>,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: mocks.profile, error: null }),
        }),
      }),
    }),
  }),
}))

import { WeeklyScheduleCard } from "./WeeklyScheduleCard"

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.profile = {
    workout_days: 3,
    wake_time: "05:30",
    weekday_workout_minutes: 25,
    weekend_workout_minutes: 60,
  }
})
afterEach(cleanup)

describe("WeeklyScheduleCard", () => {
  it("lays out all seven days with a session summary", async () => {
    render(wrap(<WeeklyScheduleCard />))
    expect(await screen.findByText(/3 sessions/)).toBeInTheDocument()
    for (const day of [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]) {
      expect(screen.getByText(day)).toBeInTheDocument()
    }
    // Longer weekend work + a short weekday session.
    expect(screen.getAllByText(/Longer session — 60 min/)).toHaveLength(2)
    expect(screen.getByText(/Express strength — 25 min/)).toBeInTheDocument()
  })

  it("shows the post-wake AM slot on weekday sessions", async () => {
    mocks.profile = { ...mocks.profile, workout_days: 4 }
    render(wrap(<WeeklyScheduleCard />))
    expect(await screen.findByText(/4 sessions/)).toBeInTheDocument()
    expect(screen.getAllByText("5:45 AM").length).toBeGreaterThan(0)
  })

  it("falls back to defaults when the profile is empty", async () => {
    mocks.profile = {
      workout_days: null,
      wake_time: null,
      weekday_workout_minutes: null,
      weekend_workout_minutes: null,
    }
    render(wrap(<WeeklyScheduleCard />))
    // Default 3 days / 25 min / 60 min.
    expect(await screen.findByText(/3 sessions/)).toBeInTheDocument()
    expect(screen.getByText(/Express strength — 25 min/)).toBeInTheDocument()
  })
})
