// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, cleanup, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { useRef } from "react"
import {
  makeSet,
  type ActiveWorkout,
} from "@/lib/active-workout"
import type { AppendInfo } from "./useWorkoutInit"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getUser: vi.fn(),
  saveWorkout: vi.fn(),
  addPending: vi.fn(),
  removePending: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}))

vi.mock("@/lib/save-workout", () => ({
  saveWorkout: mocks.saveWorkout,
}))

vi.mock("@/lib/pending-workouts", () => ({
  addPending: mocks.addPending,
  removePending: mocks.removePending,
  localStorageQueue: {},
}))

import { useFinishWorkout } from "./useFinishWorkout"

const workout: ActiveWorkout = {
  name: "Test Workout",
  templateId: null,
  startedAt: new Date("2026-08-07T09:00:00Z"),
  exercises: [
    {
      exerciseId: "chest-press-machine-flat",
      name: "Chest Press Machine",
      muscleGroups: ["chest"],
      exerciseType: "strength",
      assisted: false,
      equipmentId: "chest-press-machine",
      repsTarget: "8-12",
      sets: [{ ...makeSet(), weight: 100, reps: 10, completed: true }],
      notes: "",
      restSeconds: 60,
    },
  ],
}

beforeEach(() => {
  mocks.push.mockReset()
  mocks.getUser
    .mockReset()
    .mockResolvedValue({ data: { user: { id: "user-1" } } })
  mocks.saveWorkout.mockReset().mockResolvedValue("log-1")
  mocks.addPending.mockReset()
  mocks.removePending.mockReset()
})

afterEach(() => {
  cleanup()
})

function renderFinish(w: ActiveWorkout | null = workout) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(
    () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const appendInfo = useRef<AppendInfo | null>(null)
      return useFinishWorkout(w, appendInfo)
    },
    { wrapper }
  )
}

describe("useFinishWorkout", () => {
  it("saves and navigates to the workout detail page", async () => {
    const { result } = renderFinish()
    await act(() => result.current.finishWorkout())

    expect(mocks.saveWorkout).toHaveBeenCalledTimes(1)
    const payload = mocks.saveWorkout.mock.calls[0][1]
    expect(payload.userId).toBe("user-1")
    expect(mocks.push).toHaveBeenCalledWith("/activity/log-1")
    // Nothing parked on a clean save.
    expect(mocks.addPending).not.toHaveBeenCalled()
  })

  it("reports being signed out without attempting the save", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const { result } = renderFinish()
    await act(() => result.current.finishWorkout())

    expect(result.current.finishError).toMatch(/signed out/i)
    expect(result.current.saving).toBe(false)
    expect(mocks.saveWorkout).not.toHaveBeenCalled()
  })

  it("parks the payload and shows the error on a server-side failure", async () => {
    mocks.saveWorkout.mockRejectedValue(new Error("row violates RLS"))
    const { result } = renderFinish()
    await act(() => result.current.finishWorkout())

    await waitFor(() =>
      expect(result.current.finishError).toMatch(/row violates RLS/)
    )
    expect(mocks.addPending).toHaveBeenCalledTimes(1)
    expect(result.current.saving).toBe(false)
    // Stays on the page for an immediate retry.
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("replaces the parked entry on retry instead of stacking duplicates", async () => {
    mocks.saveWorkout.mockRejectedValue(new Error("boom"))
    const { result } = renderFinish()
    await act(() => result.current.finishWorkout())
    await act(() => result.current.finishWorkout())

    expect(mocks.addPending).toHaveBeenCalledTimes(2)
    const firstId = mocks.addPending.mock.calls[0][1].id
    // The second failure removed the first parked entry before re-parking.
    expect(mocks.removePending).toHaveBeenCalledWith({}, firstId)
  })

  it("routes to the dashboard queued banner on an offline failure", async () => {
    mocks.saveWorkout.mockRejectedValue(new Error("Failed to fetch"))
    const { result } = renderFinish()
    await act(() => result.current.finishWorkout())

    expect(mocks.addPending).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith("/dashboard?queued=1")
  })

  it("does nothing for an empty workout", async () => {
    const { result } = renderFinish({ ...workout, exercises: [] })
    await act(() => result.current.finishWorkout())
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
})
