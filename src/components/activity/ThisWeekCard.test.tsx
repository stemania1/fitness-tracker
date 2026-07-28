// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { exercises as exerciseCatalog } from "@/data/exercises"

type SbResponse = { data: unknown; error: unknown }

function makeBuilder(response: SbResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}
  b.select = () => b
  b.eq = () => b
  b.gte = () => b
  b.in = () => b
  b.order = () => b
  b.single = () => Promise.resolve(response)
  b.then = (
    onFulfilled: (value: SbResponse) => unknown,
    onRejected: (reason: unknown) => unknown
  ) => Promise.resolve(response).then(onFulfilled, onRejected)
  return b
}

const script = vi.hoisted(() => ({
  current: {} as Record<string, SbResponse>,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: (table: string) =>
      makeBuilder(script.current[table] ?? { data: null, error: null }),
  }),
}))

// Keep the streak/week-start pure helpers deterministic.
const { calcWeeklyStreak, startOfWeekISO } = vi.hoisted(() => ({
  calcWeeklyStreak: vi.fn(),
  startOfWeekISO: vi.fn(),
}))
vi.mock("@/lib/weekly-progress", () => ({ calcWeeklyStreak, startOfWeekISO }))

import { ThisWeekCard } from "./ThisWeekCard"

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

afterEach(() => {
  cleanup()
  script.current = {}
  calcWeeklyStreak.mockReset()
  startOfWeekISO.mockReset()
})

describe("ThisWeekCard", () => {
  it("shows weekly progress against target and the current streak", async () => {
    startOfWeekISO.mockReturnValue("2026-01-05T00:00:00Z")
    calcWeeklyStreak.mockReturnValue(3)
    script.current = {
      user_profiles: {
        data: {
          workout_days: 4,
          current_weight: 180,
          age: 40,
          sex: "male",
          height_inches: 70,
        },
        error: null,
      },
      // Two workouts this week (and overall); calorie query finds no exercise
      // logs, so the calories row stays hidden.
      workout_logs: {
        data: [
          { id: "w1", started_at: "2026-01-05T10:00:00Z" },
          { id: "w2", started_at: "2026-01-06T10:00:00Z" },
        ],
        error: null,
      },
      exercise_logs: { data: [], error: null },
    }

    render(<ThisWeekCard />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText("of 4 workouts", { exact: false })).toBeInTheDocument()
    )
    expect(screen.getByText("2")).toBeInTheDocument() // completed
    expect(screen.getByText("50%")).toBeInTheDocument() // 2 of 4
    expect(screen.getByText(/week streak/)).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument() // streak value
    expect(screen.queryByText(/calories burned/)).toBeNull()
  })

  it("sums and shows calories burned from this week's strength sets", async () => {
    startOfWeekISO.mockReturnValue("2026-01-05T00:00:00Z")
    calcWeeklyStreak.mockReturnValue(0)
    const strength = exerciseCatalog.find((e) => e.exerciseType === "strength")!
    script.current = {
      user_profiles: {
        data: {
          workout_days: 4,
          current_weight: 180,
          age: 40,
          sex: "male",
          height_inches: 70,
        },
        error: null,
      },
      workout_logs: {
        data: [{ id: "w1", started_at: "2026-01-05T10:00:00Z" }],
        error: null,
      },
      exercise_logs: {
        data: [{ id: "e1", exercise_id: "ex-uuid" }],
        error: null,
      },
      exercises: {
        data: [{ id: "ex-uuid", name: strength.name }],
        error: null,
      },
      set_logs: {
        data: [
          { exercise_log_id: "e1", reps: 10, weight: 100, duration_mins: null },
          { exercise_log_id: "e1", reps: 8, weight: 105, duration_mins: null },
        ],
        error: null,
      },
    }

    render(<ThisWeekCard />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText(/calories burned/)).toBeInTheDocument()
    )
  })
})
