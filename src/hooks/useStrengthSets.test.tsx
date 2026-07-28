// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { exercises as exerciseCatalog } from "@/data/exercises"

// A minimal thenable Supabase builder: every chained method returns the
// builder, and awaiting it resolves to the configured response.
type SbResponse = { data: unknown; error: unknown }

function makeBuilder(response: SbResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}
  b.select = () => b
  b.eq = () => b
  b.not = () => b
  b.then = (
    onFulfilled: (value: SbResponse) => unknown,
    onRejected: (reason: unknown) => unknown
  ) => Promise.resolve(response).then(onFulfilled, onRejected)
  return b
}

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  response: { data: null, error: null } as SbResponse,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    mocks.createClient()
    return {
      auth: { getUser: mocks.getUser },
      from: () => makeBuilder(mocks.response),
    }
  },
}))

import { useStrengthSets } from "./useStrengthSets"

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

// A real assisted exercise from the catalog, so the assisted flag is derived.
const assistedExercise = exerciseCatalog.find((e) => e.assisted)

beforeEach(() => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("useStrengthSets", () => {
  it("maps joined rows into the SetWithMeta shape", async () => {
    mocks.response = {
      data: [
        {
          weight: 135,
          reps: 5,
          exercise_log: {
            exercise: { name: "Bench Press" },
            workout_log: { started_at: "2026-01-02T10:00:00Z" },
          },
        },
      ],
      error: null,
    }
    const { result } = renderHook(() => useStrengthSets(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      {
        exerciseName: "Bench Press",
        weight: 135,
        reps: 5,
        startedAt: "2026-01-02T10:00:00Z",
        assisted: false,
      },
    ])
  })

  it("drops rows missing an exercise name or start time", async () => {
    mocks.response = {
      data: [
        { weight: 100, reps: 8, exercise_log: null },
        {
          weight: 120,
          reps: 6,
          exercise_log: {
            exercise: { name: "Squat" },
            workout_log: { started_at: "2026-01-03T10:00:00Z" },
          },
        },
      ],
      error: null,
    }
    const { result } = renderHook(() => useStrengthSets(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].exerciseName).toBe("Squat")
  })

  it("flags assisted exercises from the catalog", async () => {
    // Skip if the catalog has no assisted exercise (keeps the test honest).
    if (!assistedExercise) return
    mocks.response = {
      data: [
        {
          weight: 60,
          reps: 10,
          exercise_log: {
            exercise: { name: assistedExercise.name },
            workout_log: { started_at: "2026-01-04T10:00:00Z" },
          },
        },
      ],
      error: null,
    }
    const { result } = renderHook(() => useStrengthSets(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].assisted).toBe(true)
  })
})
