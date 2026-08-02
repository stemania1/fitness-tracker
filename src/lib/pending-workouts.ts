/**
 * A tiny persistent queue of workouts that failed to save. Stored as JSON in a
 * QueueStorage (localStorage in the browser); the queue logic is pure and
 * abstracted over storage so it's unit-tested.
 *
 * It started as an offline-only queue, which quietly meant "a save that failed
 * for any other reason is held in React state and lost the moment you navigate
 * away". Every failed save is parked here now, so the queue holds two kinds of
 * entry: ones waiting for a connection, and ones the server actively rejected.
 * The second kind can never succeed by waiting, so it needs an attempt count —
 * otherwise it retries forever behind a pill that never clears.
 */
import type { WorkoutPayload } from "@/lib/save-workout"

export interface PendingWorkout {
  /** Client-generated id for the queue entry. */
  id: string
  queuedAt: string
  payload: WorkoutPayload
  /**
   * Sync attempts that failed for a reason other than connectivity. Absent on
   * entries written before this field existed, hence the `?? 0` at every read.
   */
  attempts?: number
  /** Message from the most recent non-connectivity failure. */
  lastError?: string
}

/**
 * Non-connectivity failures tolerated before an entry is called stuck.
 *
 * Low on purpose: a rejection that repeats is a rejection that will keep
 * repeating, and the useful response is to tell the user rather than to keep
 * quietly trying.
 */
export const MAX_SYNC_ATTEMPTS = 3

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

/**
 * Record a failed sync attempt against an entry, keeping it queued.
 *
 * Only called for failures that are *not* connectivity — being offline is not
 * the entry's fault and must not count against it, or a week of gym-basement
 * saves would mark themselves unsyncable.
 */
export function markAttempt(
  store: QueueStorage,
  id: string,
  error: string
): PendingWorkout[] {
  const next = listPending(store).map((p) =>
    p.id === id ? { ...p, attempts: (p.attempts ?? 0) + 1, lastError: error } : p
  )
  store.write(JSON.stringify(next))
  return next
}

/** Whether an entry has failed enough non-network times to stop expecting it to land. */
export function isStuck(entry: PendingWorkout): boolean {
  return (entry.attempts ?? 0) >= MAX_SYNC_ATTEMPTS
}

/** Queued entries the server keeps rejecting. These need the user, not another retry. */
export function stuckPending(store: QueueStorage): PendingWorkout[] {
  return listPending(store).filter(isStuck)
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
