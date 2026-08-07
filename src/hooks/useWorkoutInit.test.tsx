// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, cleanup } from "@testing-library/react"
import { plannedSession } from "@/lib/todays-workout"

type SbResponse = { data: unknown; error?: unknown }

function makeBuilder(response: SbResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}
  b.select = () => b
  b.eq = () => b
  b.order = () => b
  b.single = () => Promise.resolve(response)
  b.then = (
    onFulfilled: (value: SbResponse) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(response).then(onFulfilled, onRejected)
  return b
}

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  script: {} as Record<string, { data: unknown; error?: unknown }>,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) =>
      makeBuilder(mocks.script[table] ?? { data: null, error: null }),
  }),
}))

import { useWorkoutInit } from "./useWorkoutInit"

beforeEach(() => {
  mocks.push.mockReset()
  mocks.script = {}
})

afterEach(() => {
  cleanup()
})

describe("useWorkoutInit", () => {
  it("starts a freestyle workout with no params", async () => {
    const { result } = renderHook(() => useWorkoutInit(null, null, null))
    await waitFor(() => expect(result.current.workout).not.toBeNull())
    expect(result.current.workout!.name).toBe("Freestyle Workout")
    expect(result.current.workout!.exercises).toEqual([])
    expect(result.current.timerStart).not.toBeNull()
    expect(result.current.appendInfo.current).toBeNull()
  })

  it("loads a template by id", async () => {
    mocks.script = {
      workout_templates: { data: { id: "t1", name: "Push Day" } },
      template_exercises: { data: [] },
    }
    const { result } = renderHook(() => useWorkoutInit("t1", null, null))
    await waitFor(() => expect(result.current.workout).not.toBeNull())
    expect(result.current.workout!.name).toBe("Push Day")
    expect(result.current.workout!.templateId).toBe("t1")
  })

  it("pre-loads today's plan session for ?plan=today", async () => {
    const { result } = renderHook(() => useWorkoutInit(null, "today", null))
    await waitFor(() => expect(result.current.workout).not.toBeNull())
    expect(result.current.workout!.name).toBe(plannedSession(new Date()).name)
  })

  it("redirects to /activity when the append target doesn't exist", async () => {
    mocks.script = { workout_logs: { data: null } }
    const { result } = renderHook(() => useWorkoutInit(null, null, "missing"))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/activity"))
    expect(result.current.workout).toBeNull()
  })

  it("appends to a saved workout, keeping its started_at and counting existing exercises", async () => {
    const startedAt = "2026-08-07T09:00:00.000Z"
    mocks.script = {
      workout_logs: {
        data: { id: "log-1", name: "Some Custom Workout", started_at: startedAt },
      },
      exercise_logs: {
        data: [
          { id: "e1", exercises: { name: "Chest Press Machine" } },
          { id: "e2", exercises: { name: "Lat Pulldown" } },
        ],
      },
    }
    const { result } = renderHook(() => useWorkoutInit(null, null, "log-1"))
    await waitFor(() => expect(result.current.workout).not.toBeNull())

    expect(result.current.workout!.name).toBe("Some Custom Workout")
    // The saved session keeps its original start; the sitting timer is fresh.
    expect(result.current.workout!.startedAt.toISOString()).toBe(startedAt)
    expect(result.current.appendInfo.current).toEqual({
      logId: "log-1",
      orderOffset: 2,
    })
    // Name doesn't match the plan session for that day → no preloaded
    // prescribed exercises.
    expect(result.current.workout!.exercises).toEqual([])
  })
})
