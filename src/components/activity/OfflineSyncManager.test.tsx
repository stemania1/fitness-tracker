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

const mocks = vi.hoisted(() => ({
  saveWorkout: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}))
vi.mock("@/lib/save-workout", () => ({
  saveWorkout: mocks.saveWorkout,
}))

import { OfflineSyncManager } from "./OfflineSyncManager"
import {
  addPending,
  listPending,
  localStorageQueue,
  MAX_SYNC_ATTEMPTS,
  type PendingWorkout,
} from "@/lib/pending-workouts"
import type { WorkoutPayload } from "@/lib/save-workout"

const payload = (name: string): WorkoutPayload => ({
  userId: "u1",
  name,
  templateId: null,
  startedAt: "2026-07-28T13:00:00.000Z",
  finishedAt: "2026-07-28T13:45:00.000Z",
  durationMins: 45,
  appendToLogId: null,
  orderOffset: 0,
  exercises: [],
})

const entry = (id: string, name = id): PendingWorkout => ({
  id,
  queuedAt: "2026-07-28T13:45:00.000Z",
  payload: payload(name),
})

function renderManager() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<OfflineSyncManager />, { wrapper })
}

/** A rejection the server would give — not a connectivity failure. */
const rejection = () => ({ message: "duplicate key value", code: "23505" })
/** What a dropped connection looks like coming out of fetch. */
const networkFailure = () => new Error("Failed to fetch")

beforeEach(() => {
  localStorage.clear()
  mocks.saveWorkout.mockReset()
})
afterEach(cleanup)

describe("OfflineSyncManager", () => {
  it("renders nothing when the queue is empty", () => {
    const { container } = renderManager()
    expect(container).toBeEmptyDOMElement()
  })

  it("flushes a queued workout and clears it", async () => {
    addPending(localStorageQueue, entry("a"))
    mocks.saveWorkout.mockResolvedValue("log-1")

    renderManager()
    await waitFor(() => expect(listPending(localStorageQueue)).toHaveLength(0))
  })

  it("does not let a rejected workout block the ones behind it", async () => {
    // The regression this guards: the old loop `break`ed on any error, so one
    // permanently-bad payload at the head kept every good workout queued.
    addPending(localStorageQueue, entry("bad"))
    addPending(localStorageQueue, entry("good"))
    mocks.saveWorkout.mockImplementation((_c: unknown, p: WorkoutPayload) =>
      p.name === "bad" ? Promise.reject(rejection()) : Promise.resolve("log-1")
    )

    renderManager()

    await waitFor(() => {
      const ids = listPending(localStorageQueue).map((p) => p.id)
      expect(ids).toEqual(["bad"])
    })
    expect(listPending(localStorageQueue)[0].attempts).toBe(1)
    expect(listPending(localStorageQueue)[0].lastError).toContain("duplicate")
  })

  it("stops the pass on a connectivity failure without burning attempts", async () => {
    // Offline is not the entry's fault. Counting it would let a week of
    // gym-basement saves mark themselves unsyncable.
    addPending(localStorageQueue, entry("a"))
    addPending(localStorageQueue, entry("b"))
    mocks.saveWorkout.mockRejectedValue(networkFailure())

    renderManager()

    await waitFor(() => expect(mocks.saveWorkout).toHaveBeenCalled())
    expect(mocks.saveWorkout).toHaveBeenCalledTimes(1) // broke out, didn't try b
    for (const p of listPending(localStorageQueue)) {
      expect(p.attempts ?? 0).toBe(0)
    }
  })

  it("reports entries the server keeps rejecting instead of retrying forever", async () => {
    addPending(localStorageQueue, {
      ...entry("bad"),
      attempts: MAX_SYNC_ATTEMPTS,
      lastError: "duplicate key value",
    })
    mocks.saveWorkout.mockRejectedValue(rejection())

    renderManager()

    expect(await screen.findByText(/couldn't sync/i)).toBeDefined()
    // Skipped on the automatic pass — repeating a known answer helps nobody.
    expect(mocks.saveWorkout).not.toHaveBeenCalled()
  })

  it("retries a stuck entry only when asked", async () => {
    addPending(localStorageQueue, {
      ...entry("bad"),
      attempts: MAX_SYNC_ATTEMPTS,
    })
    mocks.saveWorkout.mockResolvedValue("log-1")

    renderManager()
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }))

    await waitFor(() => expect(listPending(localStorageQueue)).toHaveLength(0))
  })

  it("requires a second tap before discarding a stuck workout", async () => {
    addPending(localStorageQueue, {
      ...entry("bad"),
      attempts: MAX_SYNC_ATTEMPTS,
    })

    renderManager()
    const discard = await screen.findByRole("button", { name: /discard/i })

    fireEvent.click(discard)
    expect(listPending(localStorageQueue)).toHaveLength(1) // still there

    fireEvent.click(screen.getByRole("button", { name: /sure/i }))
    await waitFor(() => expect(listPending(localStorageQueue)).toHaveLength(0))
  })

  it("keeps a healthy queued workout while a stuck one is discarded", async () => {
    addPending(localStorageQueue, {
      ...entry("bad"),
      attempts: MAX_SYNC_ATTEMPTS,
    })
    addPending(localStorageQueue, entry("waiting"))
    mocks.saveWorkout.mockRejectedValue(networkFailure())

    renderManager()
    fireEvent.click(await screen.findByRole("button", { name: /discard/i }))
    fireEvent.click(screen.getByRole("button", { name: /sure/i }))

    await waitFor(() =>
      expect(listPending(localStorageQueue).map((p) => p.id)).toEqual([
        "waiting",
      ])
    )
  })
})
