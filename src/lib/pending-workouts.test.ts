import { describe, it, expect } from "vitest"
import {
  listPending,
  addPending,
  removePending,
  markAttempt,
  isStuck,
  stuckPending,
  MAX_SYNC_ATTEMPTS,
  type PendingWorkout,
  type QueueStorage,
} from "./pending-workouts"
import type { WorkoutPayload } from "./save-workout"

function memoryStore(initial: string | null = null): QueueStorage {
  let value = initial
  return {
    read: () => value,
    write: (v) => {
      value = v
    },
  }
}

const payload: WorkoutPayload = {
  userId: "u1",
  name: "Pull A",
  templateId: null,
  startedAt: "2026-07-11T13:00:00.000Z",
  finishedAt: "2026-07-11T13:45:00.000Z",
  durationMins: 45,
  appendToLogId: null,
  orderOffset: 0,
  exercises: [],
}

const entry = (id: string): PendingWorkout => ({
  id,
  queuedAt: "2026-07-11T13:45:00.000Z",
  payload: { ...payload },
})

describe("pending-workouts queue", () => {
  it("starts empty", () => {
    expect(listPending(memoryStore())).toEqual([])
  })

  it("adds and lists entries in order", () => {
    const store = memoryStore()
    addPending(store, entry("a"))
    addPending(store, entry("b"))
    const list = listPending(store)
    expect(list.map((p) => p.id)).toEqual(["a", "b"])
    expect(list[0].payload.name).toBe("Pull A")
  })

  it("removes an entry by id", () => {
    const store = memoryStore()
    addPending(store, entry("a"))
    addPending(store, entry("b"))
    removePending(store, "a")
    expect(listPending(store).map((p) => p.id)).toEqual(["b"])
  })

  it("survives corrupt storage by returning empty", () => {
    expect(listPending(memoryStore("not json"))).toEqual([])
    expect(listPending(memoryStore("{}"))).toEqual([]) // not an array
  })
})

describe("attempt tracking", () => {
  it("counts a failed attempt without dropping the entry", () => {
    const store = memoryStore()
    addPending(store, entry("a"))
    markAttempt(store, "a", "duplicate key")

    const [e] = listPending(store)
    expect(e.id).toBe("a")
    expect(e.attempts).toBe(1)
    expect(e.lastError).toBe("duplicate key")
    // The payload must survive — it's the whole reason the entry exists.
    expect(e.payload.name).toBe("Pull A")
  })

  it("accumulates across attempts and keeps the latest error", () => {
    const store = memoryStore()
    addPending(store, entry("a"))
    markAttempt(store, "a", "first")
    markAttempt(store, "a", "second")
    expect(listPending(store)[0].attempts).toBe(2)
    expect(listPending(store)[0].lastError).toBe("second")
  })

  it("only touches the entry named", () => {
    const store = memoryStore()
    addPending(store, entry("a"))
    addPending(store, entry("b"))
    markAttempt(store, "a", "boom")
    const byId = Object.fromEntries(listPending(store).map((p) => [p.id, p]))
    expect(byId.a.attempts).toBe(1)
    expect(byId.b.attempts).toBeUndefined()
  })

  it("treats an entry written before the field existed as zero attempts", () => {
    // Real localStorage will hold these after a deploy; `?? 0` must hold.
    const legacy = memoryStore(JSON.stringify([entry("old")]))
    expect(isStuck(listPending(legacy)[0])).toBe(false)
    markAttempt(legacy, "old", "boom")
    expect(listPending(legacy)[0].attempts).toBe(1)
  })

  it("becomes stuck only at the threshold", () => {
    const store = memoryStore()
    addPending(store, entry("a"))
    for (let i = 1; i < MAX_SYNC_ATTEMPTS; i++) {
      markAttempt(store, "a", "boom")
      expect(stuckPending(store)).toEqual([])
    }
    markAttempt(store, "a", "boom")
    expect(stuckPending(store).map((p) => p.id)).toEqual(["a"])
  })

  it("separates stuck entries from ones still worth retrying", () => {
    const store = memoryStore()
    addPending(store, entry("bad"))
    addPending(store, entry("fine"))
    for (let i = 0; i < MAX_SYNC_ATTEMPTS; i++) markAttempt(store, "bad", "boom")

    expect(stuckPending(store).map((p) => p.id)).toEqual(["bad"])
    expect(listPending(store)).toHaveLength(2)
  })

  it("is a no-op for an id that is not queued", () => {
    const store = memoryStore()
    addPending(store, entry("a"))
    markAttempt(store, "ghost", "boom")
    expect(listPending(store)).toHaveLength(1)
    expect(listPending(store)[0].attempts).toBeUndefined()
  })
})
