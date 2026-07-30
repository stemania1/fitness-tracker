/**
 * Pure pieces of finishing a workout: what gets persisted, what gets dropped,
 * and whether a failed save should be queued for replay.
 *
 * These were inline in the logger's `finishWorkout`, which is the riskiest
 * code in the file — it decides what survives the session — and was the least
 * covered.
 */

import type { WorkoutPayload } from "./save-workout"
import type { ActiveExercise, ActiveWorkout } from "./active-workout"

/** Exercises with no checked-off set. These are dropped on save. */
export function uncheckedExercises(
  workout: ActiveWorkout | null
): ActiveExercise[] {
  if (!workout) return []
  return workout.exercises.filter((ex) => ex.sets.every((s) => !s.completed))
}

/** Whole minutes between start and finish, never negative. */
export function workoutDurationMins(startedAt: Date, finishedAt: Date): number {
  return Math.max(
    0,
    Math.round((finishedAt.getTime() - startedAt.getTime()) / 60000)
  )
}

export interface AppendTarget {
  logId: string
  orderOffset: number
}

/**
 * Build the serializable payload — used to save now, or queued and replayed
 * if the device is offline.
 *
 * Only sets the user checked off are persisted, and an exercise with no
 * checked sets is dropped entirely. Surviving exercises keep their index in
 * the on-screen list rather than being renumbered, so dropping one leaves a
 * gap in `orderIndex`; that is deliberate, since order_index is only a sort
 * key and preserving it keeps the saved order matching what was on screen.
 *
 * When appending to an existing log, `workout.exercises` holds only the NEW
 * exercises and `append.orderOffset` shifts them past what is already logged.
 */
export function buildWorkoutPayload({
  workout,
  userId,
  finishedAt,
  append = null,
}: {
  workout: ActiveWorkout
  userId: string
  finishedAt: Date
  append?: AppendTarget | null
}): WorkoutPayload {
  return {
    userId,
    name: workout.name,
    templateId: workout.templateId,
    startedAt: workout.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMins: workoutDurationMins(workout.startedAt, finishedAt),
    appendToLogId: append?.logId ?? null,
    orderOffset: append?.orderOffset ?? 0,
    exercises: workout.exercises
      .map((ex, ei) => ({ ex, ei }))
      .filter(({ ex }) => ex.sets.some((s) => s.completed))
      .map(({ ex, ei }) => ({
        exerciseId: ex.exerciseId,
        notes: ex.notes,
        orderIndex: ei,
        completedSets: ex.sets
          .filter((s) => s.completed)
          .map((s) => ({
            reps: s.reps,
            weight: s.weight,
            durationMins: s.durationMins,
            distanceMiles: s.distanceMiles,
            inclinePercent: s.inclinePercent,
            rpe: s.rpe,
          })),
      })),
  }
}

const NETWORK_ERROR = /load failed|failed to fetch|networkerror/i

/**
 * Pull a message off whatever was thrown, without assuming it is an `Error`.
 *
 * Supabase rejects with a plain `{ message, code, details }` object, not an
 * Error instance — an `instanceof Error` check would miss every database and
 * network failure the app actually sees. Non-objects and objects without a
 * string message yield "" rather than throwing.
 */
function errorMessage(err: unknown): string {
  if (typeof err === "string") return err
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message
    return typeof message === "string" ? message : ""
  }
  return ""
}

/**
 * Whether a failed save looks like a connectivity problem, in which case the
 * session is queued rather than reported as an error — losing a logged workout
 * to a dropped signal in a gym basement is the worst outcome here.
 *
 * `navigator.onLine` alone is not enough: iOS reports online while a request
 * still fails on a flaky connection, so the error text is checked too.
 * Anything that is not recognisably a network failure is surfaced to the user
 * instead of being silently queued.
 */
export function isOfflineError(
  err: unknown,
  online: boolean = typeof navigator === "undefined" ? true : navigator.onLine
): boolean {
  if (!online) return true
  return NETWORK_ERROR.test(errorMessage(err))
}

/** Message to show when a save fails for a reason that is not connectivity. */
export function saveErrorMessage(err: unknown): string {
  return errorMessage(err) || "Couldn't save the workout. Try again."
}
