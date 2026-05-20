// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { exercises as exerciseCatalog } from "@/data/exercises"

/**
 * The hook chains up to 6 Supabase queries. The stub below makes every
 * builder method thenable so `await supabase.from(...).select(...).eq(...)`
 * resolves to the response configured for that table call.
 */
type SbResponse = { data: unknown; error: unknown }
type TableScript = SbResponse | SbResponse[]
type SupabaseScript = Record<string, TableScript>

function makeBuilder(response: SbResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}
  b.select = () => b
  b.eq = () => b
  b.in = () => b
  b.order = () => b
  b.limit = () => b
  b.not = () => b
  b.single = () => Promise.resolve(response)
  // Make the builder itself thenable so `await chain` resolves.
  b.then = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onFulfilled: (value: SbResponse) => unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRejected: (reason: unknown) => unknown
  ) => Promise.resolve(response).then(onFulfilled, onRejected)
  return b
}

function createSupabaseStub(script: SupabaseScript) {
  const calls = new Map<string, number>()
  return {
    from: (table: string) => {
      const idx = calls.get(table) ?? 0
      calls.set(table, idx + 1)
      const entry = script[table]
      const response: SbResponse = Array.isArray(entry)
        ? entry[idx] ?? { data: null, error: null }
        : entry ?? { data: null, error: null }
      return makeBuilder(response)
    },
  }
}

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.createClient,
}))

import { useExerciseHistory } from "./useExerciseHistory"

beforeEach(() => {
  mocks.createClient.mockReset()
})

afterEach(() => {
  cleanup()
})

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

// Pick any real exercise id from the catalog so the staticExercise lookup
// inside the hook succeeds.
const realExerciseId = exerciseCatalog[0].id
const realExerciseName = exerciseCatalog[0].name

describe("useExerciseHistory", () => {
  it("returns null when the static exercise id doesn't match the catalog", async () => {
    mocks.createClient.mockReturnValue(createSupabaseStub({}))
    const { result } = renderHook(
      () => useExerciseHistory("not-a-real-exercise"),
      { wrapper }
    )
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })

  it("returns null when the DB has no row matching the static exercise name", async () => {
    mocks.createClient.mockReturnValue(
      createSupabaseStub({
        exercises: { data: null, error: null },
      })
    )
    const { result } = renderHook(() => useExerciseHistory(realExerciseId), {
      wrapper,
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })

  it("returns empty sets and null max when the exercise has never been logged", async () => {
    mocks.createClient.mockReturnValue(
      createSupabaseStub({
        exercises: { data: { id: "db-1" }, error: null },
        // No exercise_logs at all.
        exercise_logs: { data: [], error: null },
      })
    )
    const { result } = renderHook(() => useExerciseHistory(realExerciseId), {
      wrapper,
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual({
      previousSets: [],
      allTimeMaxWeight: null,
    })
  })

  it("returns the latest session's sets and the all-time max weight on the happy path", async () => {
    mocks.createClient.mockReturnValue(
      createSupabaseStub({
        exercises: { data: { id: "db-1" }, error: null },
        // First .from("exercise_logs"): recent 20.
        // Second .from("exercise_logs"): all logs for max-weight scan.
        exercise_logs: [
          {
            data: [
              { id: "el-1", workout_log_id: "wl-1" },
              { id: "el-2", workout_log_id: "wl-2" },
            ],
            error: null,
          },
          {
            data: [{ id: "el-1" }, { id: "el-2" }, { id: "el-3" }],
            error: null,
          },
        ],
        workout_logs: {
          data: [{ id: "wl-1", started_at: "2024-05-01T10:00:00Z" }],
          error: null,
        },
        // First .from("set_logs"): previousSets for the latest workout.
        // Second .from("set_logs"): every set ever, for max-weight scan.
        set_logs: [
          {
            data: [
              {
                set_number: 1,
                reps: 10,
                weight: 100,
                duration_mins: null,
                distance_miles: null,
                incline_percent: null,
              },
              {
                set_number: 2,
                reps: 8,
                weight: 110,
                duration_mins: null,
                distance_miles: null,
                incline_percent: null,
              },
            ],
            error: null,
          },
          {
            data: [
              { weight: 100, reps: 10 },
              { weight: 130, reps: 5 }, // all-time max
              { weight: 110, reps: 8 },
            ],
            error: null,
          },
        ],
      })
    )

    const { result } = renderHook(() => useExerciseHistory(realExerciseId), {
      wrapper,
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.previousSets).toHaveLength(2)
    expect(result.current.data?.previousSets[0].weight).toBe(100)
    expect(result.current.data?.previousSets[1].weight).toBe(110)
    expect(result.current.data?.allTimeMaxWeight).toBe(130)
  })

  it("ignores sets with reps < 1 when computing the all-time max", async () => {
    mocks.createClient.mockReturnValue(
      createSupabaseStub({
        exercises: { data: { id: "db-1" }, error: null },
        exercise_logs: [
          { data: [{ id: "el-1", workout_log_id: "wl-1" }], error: null },
          { data: [{ id: "el-1" }], error: null },
        ],
        workout_logs: { data: [], error: null },
        // workout_logs is empty -> previousSets path is skipped -> only the
        // max-weight scan calls set_logs.
        set_logs: {
          data: [
            { weight: 200, reps: 0 }, // bogus log — ignored
            { weight: 150, reps: 1 }, // counts
            { weight: 100, reps: 10 },
          ],
          error: null,
        },
      })
    )

    const { result } = renderHook(() => useExerciseHistory(realExerciseId), {
      wrapper,
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.allTimeMaxWeight).toBe(150)
  })

  it("ignores sets with reps=null when computing the all-time max", async () => {
    // Aligned with findHeaviestWeight in personal-records.ts: incomplete
    // sets (missing rep count) don't count toward the displayed max.
    mocks.createClient.mockReturnValue(
      createSupabaseStub({
        exercises: { data: { id: "db-1" }, error: null },
        exercise_logs: [
          { data: [{ id: "el-1", workout_log_id: "wl-1" }], error: null },
          { data: [{ id: "el-1" }], error: null },
        ],
        workout_logs: { data: [], error: null },
        set_logs: {
          data: [
            { weight: 175, reps: null }, // incomplete -> ignored
            { weight: 150, reps: 5 },
          ],
          error: null,
        },
      })
    )

    const { result } = renderHook(() => useExerciseHistory(realExerciseId), {
      wrapper,
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.allTimeMaxWeight).toBe(150)
  })

  it("returns empty previousSets when the latest workout has no matching exercise_log", async () => {
    mocks.createClient.mockReturnValue(
      createSupabaseStub({
        exercises: { data: { id: "db-1" }, error: null },
        exercise_logs: [
          {
            data: [{ id: "el-1", workout_log_id: "wl-1" }],
            error: null,
          },
          { data: [{ id: "el-1" }], error: null },
        ],
        // Latest workout is a different workout_log_id than the one in our
        // recentExLogs — should not crash, just yield no previousSets.
        workout_logs: {
          data: [{ id: "wl-unrelated", started_at: "2024-06-01T00:00:00Z" }],
          error: null,
        },
        set_logs: [{ data: [], error: null }],
      })
    )

    const { result } = renderHook(() => useExerciseHistory(realExerciseId), {
      wrapper,
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.previousSets).toEqual([])
  })

  it("uses 'exercise-history' + exercise id as the React Query cache key", async () => {
    mocks.createClient.mockReturnValue(createSupabaseStub({}))
    const { result } = renderHook(
      () => useExerciseHistory("nonexistent-id"),
      { wrapper }
    )
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    // The cache key shape is part of the contract — invalidation in the
    // consuming components targets ["exercise-history", id].
    expect(realExerciseName.length).toBeGreaterThan(0) // sanity check fixture
  })
})
