/**
 * Compare a just-finished workout to previous sessions, exercise by exercise,
 * so the workout detail page can show a "you beat last time on N of M lifts"
 * recap. Pure; the detail page supplies this session's top weights and each
 * exercise's previous best.
 */

export type RecapStatus = "up" | "same" | "down" | "new"

export interface RecapExerciseInput {
  name: string
  /** Heaviest weight lifted this session for this exercise; null for cardio /
   *  bodyweight sets with no weight (excluded from the recap). */
  currentTopWeight: number | null
  /** Heaviest weight from any earlier session, or null if this is the first. */
  previousTopWeight: number | null
}

export interface RecapItem {
  name: string
  currentTopWeight: number
  previousTopWeight: number | null
  /** current − previous, or null when there's no previous to compare. */
  delta: number | null
  status: RecapStatus
}

export interface SessionRecap {
  items: RecapItem[]
  /** Exercises where you lifted more than any previous session. */
  beatCount: number
  /** Exercises that had a previous session to compare against. */
  comparableCount: number
}

export function buildSessionRecap(
  exercises: RecapExerciseInput[]
): SessionRecap {
  const items: RecapItem[] = []

  for (const ex of exercises) {
    if (ex.currentTopWeight == null) continue // no weighted set this session
    const prev = ex.previousTopWeight
    let status: RecapStatus
    let delta: number | null = null
    if (prev == null) {
      status = "new"
    } else {
      delta = Math.round((ex.currentTopWeight - prev) * 100) / 100
      status = delta > 0 ? "up" : delta < 0 ? "down" : "same"
    }
    items.push({
      name: ex.name,
      currentTopWeight: ex.currentTopWeight,
      previousTopWeight: prev,
      delta,
      status,
    })
  }

  const comparableCount = items.filter((i) => i.status !== "new").length
  const beatCount = items.filter((i) => i.status === "up").length
  return { items, beatCount, comparableCount }
}
