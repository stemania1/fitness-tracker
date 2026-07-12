/**
 * A tiny persistent queue of workouts that failed to save because the device
 * was offline. Stored as JSON in a QueueStorage (localStorage in the browser);
 * the queue logic is pure and abstracted over storage so it's unit-tested.
 */
import type { WorkoutPayload } from "@/lib/save-workout"

export interface PendingWorkout {
  /** Client-generated id for the queue entry. */
  id: string
  queuedAt: string
  payload: WorkoutPayload
}

export interface QueueStorage {
  read(): string | null
  write(value: string): void
}

const KEY = "pending-workouts"

export function listPending(store: QueueStorage): PendingWorkout[] {
  try {
    const raw = store.read()
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingWorkout[]) : []
  } catch {
    return []
  }
}

export function addPending(
  store: QueueStorage,
  entry: PendingWorkout
): PendingWorkout[] {
  const next = [...listPending(store), entry]
  store.write(JSON.stringify(next))
  return next
}

export function removePending(
  store: QueueStorage,
  id: string
): PendingWorkout[] {
  const next = listPending(store).filter((p) => p.id !== id)
  store.write(JSON.stringify(next))
  return next
}

/** Browser localStorage adapter (best-effort; never throws). */
export const localStorageQueue: QueueStorage = {
  read() {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(KEY)
        : null
    } catch {
      return null
    }
  },
  write(value: string) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(KEY, value)
    } catch {
      // storage full / unavailable — nothing we can do
    }
  },
}
