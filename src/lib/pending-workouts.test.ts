import { describe, it, expect } from "vitest"
import {
  listPending,
  addPending,
  removePending,
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
