// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import type { TodaysWorkout } from "@/lib/todays-workout"

// createClient runs at module top level in the component, and useRouter /
// todaysWorkout are called during render, so all three are mocked before the
// component import. vi.hoisted keeps the shared refs alive for the factories.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  workout: null as unknown as TodaysWorkout,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_table: string) => ({ insert: mocks.insert }),
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
}))

vi.mock("@/lib/todays-workout", () => ({
  todaysWorkout: () => mocks.workout,
}))

import { TodaysWorkoutSession } from "./TodaysWorkoutSession"

const STRENGTH_WORKOUT: TodaysWorkout = {
  week: 1,
  title: "Pull A",
  time: "6:30 AM",
  durationMins: 45,
  type: "strength",
  phaseLabel: "Base",
  isRest: false,
  isDeload: false,
  testTitle: null,
  sessionNote: null,
  items: [
    { id: "assisted-pull-up-0", label: "Assisted Pull-Up", detail: "4 × 6-8" },
    { id: "lat-pulldown-1", label: "Lat Pulldown", detail: "3 × 8-12" },
  ],
}

const REST_WORKOUT: TodaysWorkout = {
  week: 1,
  title: "Rest",
  time: "",
  durationMins: 0,
  type: "rest",
  phaseLabel: "Base",
  isRest: true,
  isDeload: false,
  testTitle: null,
  sessionNote: null,
  items: [],
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } })
  mocks.insert.mockReset().mockResolvedValue({ error: null })
  mocks.push.mockReset()
  mocks.back.mockReset()
  mocks.workout = STRENGTH_WORKOUT
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe("TodaysWorkoutSession", () => {
  it("renders the prescribed items with a starting 0/N progress", () => {
    renderWithClient(<TodaysWorkoutSession />)
    expect(screen.getByText("Assisted Pull-Up")).toBeInTheDocument()
    expect(screen.getByText("Lat Pulldown")).toBeInTheDocument()
    expect(screen.getByText("4 × 6-8")).toBeInTheDocument()
    // Progress counter and the finish button both start at 0/2.
    expect(screen.getByText("0/2")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /finish workout \(0\/2\)/i })
    ).toBeInTheDocument()
  })

  it("checks an item off and advances the counter", () => {
    renderWithClient(<TodaysWorkoutSession />)
    fireEvent.click(screen.getByText("Assisted Pull-Up"))
    expect(screen.getByText("1/2")).toBeInTheDocument()
    // Toggling again unchecks it.
    fireEvent.click(screen.getByText("Assisted Pull-Up"))
    expect(screen.getByText("0/2")).toBeInTheDocument()
  })

  it("shows the all-done label once every item is checked", () => {
    renderWithClient(<TodaysWorkoutSession />)
    fireEvent.click(screen.getByText("Assisted Pull-Up"))
    fireEvent.click(screen.getByText("Lat Pulldown"))
    expect(
      screen.getByRole("button", { name: /finish workout ✓/i })
    ).toBeInTheDocument()
  })

  it("logs a completed workout and returns to the dashboard on finish", async () => {
    renderWithClient(<TodaysWorkoutSession />)
    fireEvent.click(screen.getByText("Assisted Pull-Up"))
    fireEvent.click(
      screen.getByRole("button", { name: /finish workout/i })
    )

    await waitFor(() => {
      expect(mocks.insert).toHaveBeenCalledTimes(1)
    })
    const row = mocks.insert.mock.calls[0][0]
    expect(row.user_id).toBe("user-1")
    expect(row.name).toBe("Pull A")
    expect(typeof row.started_at).toBe("string")
    expect(typeof row.finished_at).toBe("string")
    expect(row.duration_mins).toBeGreaterThanOrEqual(1)
    expect(row.notes).toMatch(/completed 1 of 2/i)

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith("/dashboard")
    })
  })

  it("persists progress to localStorage so a reload restores checks", () => {
    const { unmount } = renderWithClient(<TodaysWorkoutSession />)
    fireEvent.click(screen.getByText("Assisted Pull-Up"))
    expect(screen.getByText("1/2")).toBeInTheDocument()
    unmount()

    // Re-mount: the previously checked item is restored from storage.
    renderWithClient(<TodaysWorkoutSession />)
    expect(screen.getByText("1/2")).toBeInTheDocument()
  })

  it("shows a rest-day state with no checklist on rest days", () => {
    mocks.workout = REST_WORKOUT
    renderWithClient(<TodaysWorkoutSession />)
    expect(screen.getByText(/rest day/i)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /finish workout/i })
    ).toBeNull()
  })
})
