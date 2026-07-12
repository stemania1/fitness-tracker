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
import { exercises as catalog } from "@/data/exercises"

// A real strength exercise to feed through the (mocked) picker.
const PICK = catalog.find((e) => e.exerciseType === "strength")!

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  params: new Map<string, string>(),
  getUser: vi.fn(),
  insert: vi.fn(),
  // last inserted rows, by table
  inserted: {} as Record<string, unknown[]>,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
  useSearchParams: () => ({ get: (k: string) => mocks.params.get(k) ?? null }),
}))

// Supabase: a tiny chainable stub covering the queries the page makes.
function makeBuilder(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    in: () => chain,
    single: async () => {
      if (table === "user_profiles")
        return { data: { current_weight: 180, age: 51, sex: "male", height_inches: 70 } }
      // workout_logs / exercise_logs insert().select().single()
      return { data: { id: `${table}-id` }, error: null }
    },
    insert: (rows: unknown) => {
      mocks.inserted[table] = [
        ...(mocks.inserted[table] ?? []),
        ...(Array.isArray(rows) ? rows : [rows]),
      ]
      mocks.insert(table, rows)
      return chain
    },
  }
  return chain
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (t: string) => makeBuilder(t),
  }),
}))

vi.mock("@/lib/supabase/exercises", () => ({
  ensureExercisesExist: async (_c: unknown, ids: string[]) =>
    new Map(ids.map((id) => [id, `db-${id}`])),
}))

vi.mock("@/hooks/useExerciseHistory", () => ({
  useExerciseHistory: () => ({ data: null }),
}))

// Child components that would otherwise pull in Supabase / timers.
vi.mock("@/components/activity/exercise-picker", () => ({
  ExercisePicker: ({
    onSelect,
  }: {
    onSelect: (e: typeof PICK) => void
  }) => (
    <button onClick={() => onSelect(PICK)}>mock-pick-exercise</button>
  ),
}))
vi.mock("@/components/activity/rest-timer", () => ({
  RestTimer: () => null,
}))
vi.mock("@/components/activity/PreviousPerformance", () => ({
  PreviousPerformance: () => null,
}))
vi.mock("@/components/activity/OverloadSuggestion", () => ({
  OverloadSuggestion: () => null,
}))

import LogWorkoutPage from "./page"

beforeEach(() => {
  mocks.push.mockReset()
  mocks.back.mockReset()
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.insert.mockReset()
  mocks.inserted = {}
  mocks.params = new Map()
})

afterEach(() => cleanup())

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <LogWorkoutPage />
    </QueryClientProvider>
  )
}

describe("LogWorkoutPage (freestyle)", () => {
  it("loads without crashing and shows the empty state", async () => {
    renderPage()
    expect(await screen.findByText(/no exercises yet/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /add exercise/i })
    ).toBeInTheDocument()
  })

  it("adds an exercise, logs a set, and saves the workout", async () => {
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: /add exercise/i }))
    // Mocked picker → selects a real catalog exercise.
    fireEvent.click(screen.getByText(/mock-pick-exercise/i))

    // The exercise header appears.
    expect(await screen.findByText(PICK.name)).toBeInTheDocument()

    // Enter weight + reps on the first set (the default has several sets).
    const weight = screen.getAllByPlaceholderText("lbs")[0]
    const reps = screen.getAllByPlaceholderText("reps")[0]
    fireEvent.change(weight, { target: { value: "100" } })
    fireEvent.change(reps, { target: { value: "8" } })

    // Complete that set — the toggle is the only button in the set-row grid.
    const setRow = weight.parentElement!
    fireEvent.click(setRow.querySelector("button")!)

    // Finish.
    fireEvent.click(screen.getByRole("button", { name: /^finish$/i }))

    await waitFor(() =>
      expect(mocks.inserted["workout_logs"]?.length).toBe(1)
    )
    const log = mocks.inserted["workout_logs"][0] as Record<string, unknown>
    expect(log.name).toBe("Freestyle Workout")
    expect(log.user_id).toBe("u1")
    // A set row was written.
    await waitFor(() =>
      expect(mocks.inserted["set_logs"]?.length).toBeGreaterThan(0)
    )
    const savedSet = mocks.inserted["set_logs"][0] as Record<string, unknown>
    expect(savedSet.weight).toBe(100)
    expect(savedSet.reps).toBe(8)
    // Navigated to the saved workout.
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/activity/workout_logs-id")
    )
  })

  it("warns before finishing when an exercise has no completed set", async () => {
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: /add exercise/i }))
    fireEvent.click(screen.getByText(/mock-pick-exercise/i))
    await screen.findByText(PICK.name)

    // Finish immediately — nothing checked off.
    fireEvent.click(screen.getByRole("button", { name: /^finish$/i }))

    expect(await screen.findByText(/save without these/i)).toBeInTheDocument()
    // Did not save yet.
    expect(mocks.inserted["workout_logs"]).toBeUndefined()

    // Confirm → saves.
    fireEvent.click(screen.getByRole("button", { name: /save anyway/i }))
    await waitFor(() =>
      expect(mocks.inserted["workout_logs"]?.length).toBe(1)
    )
  })
})
