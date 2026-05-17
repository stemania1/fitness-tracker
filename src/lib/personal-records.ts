/**
 * Personal records and 1RM estimates.
 *
 * 1RM uses the Epley formula: weight × (1 + reps/30). It tracks well with
 * actual 1RM up to ~10-12 reps; beyond that it overestimates noticeably,
 * but for our purposes (relative progress over time) that's fine.
 */

/** Estimate one-rep max from a working set. Returns null for invalid input. */
export function estimateOneRepMax(
  weight: number | null,
  reps: number | null
): number | null {
  if (weight == null || reps == null) return null
  if (weight <= 0 || reps <= 0) return null
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/** Round an e1RM to one decimal place for display. */
export function formatE1RM(value: number | null): string {
  if (value == null) return "—"
  return `${Math.round(value * 10) / 10} lbs`
}

export interface SetForPR {
  weight: number | null
  reps: number | null
}

/**
 * Find the heaviest weight (at any rep count ≥ 1) across the given sets.
 * Used to determine the all-time max for an exercise.
 */
export function findHeaviestWeight(sets: SetForPR[]): number | null {
  let max: number | null = null
  for (const s of sets) {
    if (s.weight == null || s.reps == null) continue
    if (s.weight <= 0 || s.reps < 1) continue
    if (max == null || s.weight > max) max = s.weight
  }
  return max
}

/**
 * Is `set` a new personal record compared to `previousMaxWeight`?
 * A PR requires beating the previous max strictly (equal weight doesn't
 * count, to avoid spamming notifications on routine working sets).
 */
export function isNewPersonalRecord(
  set: SetForPR,
  previousMaxWeight: number | null
): boolean {
  if (set.weight == null || set.reps == null) return false
  if (set.weight <= 0 || set.reps < 1) return false
  if (previousMaxWeight == null) return true
  return set.weight > previousMaxWeight
}

export interface SetWithMeta {
  /** Exercise name. PRs are tracked per-exercise. */
  exerciseName: string
  weight: number | null
  reps: number | null
  /** When the workout containing this set started, as an ISO string. */
  startedAt: string
}

export interface RecentPR {
  exerciseName: string
  weight: number
  reps: number
  startedAt: string
  /** The previous max weight for this exercise before this PR was set. */
  previousMaxWeight: number | null
}

/** Rep PRs track "most reps ever at this weight" for an exercise — a way
 *  to celebrate progress without bumping the weight. */
export interface RecentRepPR {
  exerciseName: string
  weight: number
  reps: number
  startedAt: string
  /** The previous max reps at this same weight, before this PR was set. */
  previousMaxReps: number | null
}

/**
 * Find the most recent personal-record-setting set per exercise within
 * the last `sinceDays`. Returns at most one entry per exercise (the
 * latest PR), sorted by startedAt descending.
 *
 * Pure function — caller supplies all the sets they want to consider,
 * typically every strength set the user has ever logged.
 */
export function findRecentPRs(
  sets: SetWithMeta[],
  sinceDays: number,
  now: Date = new Date()
): RecentPR[] {
  const cutoff = now.getTime() - sinceDays * 24 * 60 * 60 * 1000

  // Walk all sets in chronological order, tracking the running max per
  // exercise. A set that strictly beats its exercise's running max is
  // a PR.
  const ordered = [...sets].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt)
  )
  const runningMax = new Map<string, number>()
  const latestPRByExercise = new Map<string, RecentPR>()

  for (const s of ordered) {
    if (s.weight == null || s.reps == null) continue
    if (s.weight <= 0 || s.reps < 1) continue
    const prevMax = runningMax.get(s.exerciseName) ?? null
    const isPR = prevMax == null || s.weight > prevMax
    if (isPR) {
      runningMax.set(s.exerciseName, s.weight)
      const ts = new Date(s.startedAt).getTime()
      if (Number.isFinite(ts) && ts >= cutoff) {
        latestPRByExercise.set(s.exerciseName, {
          exerciseName: s.exerciseName,
          weight: s.weight,
          reps: s.reps,
          startedAt: s.startedAt,
          previousMaxWeight: prevMax,
        })
      }
    }
  }

  return [...latestPRByExercise.values()].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt)
  )
}

/**
 * Find the most recent rep-PR per exercise within the last `sinceDays`.
 * A rep PR is "most reps ever at this same weight" — useful for tracking
 * progress at sub-max working weights, where you might rep out before
 * adding load.
 *
 * Returns at most one entry per exercise (the latest rep PR), sorted by
 * startedAt descending. Excludes single-rep sets (a 1RM attempt is not a
 * rep PR).
 */
export function findRecentRepPRs(
  sets: SetWithMeta[],
  sinceDays: number,
  now: Date = new Date()
): RecentRepPR[] {
  const cutoff = now.getTime() - sinceDays * 24 * 60 * 60 * 1000

  const ordered = [...sets].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt)
  )

  // Running max reps per (exercise, weight) pair.
  const runningMaxReps = new Map<string, number>()
  const latestRepPRByExercise = new Map<string, RecentRepPR>()

  for (const s of ordered) {
    if (s.weight == null || s.reps == null) continue
    if (s.weight <= 0 || s.reps < 2) continue // singles don't count
    const key = `${s.exerciseName}|${s.weight}`
    const prevMax = runningMaxReps.get(key) ?? null
    const isPR = prevMax == null || s.reps > prevMax
    if (isPR) {
      runningMaxReps.set(key, s.reps)
      const ts = new Date(s.startedAt).getTime()
      if (Number.isFinite(ts) && ts >= cutoff && prevMax != null) {
        // Require a prior entry at this weight — otherwise this is just
        // "first time doing this weight" which isn't very meaningful.
        latestRepPRByExercise.set(s.exerciseName, {
          exerciseName: s.exerciseName,
          weight: s.weight,
          reps: s.reps,
          startedAt: s.startedAt,
          previousMaxReps: prevMax,
        })
      }
    }
  }

  return [...latestRepPRByExercise.values()].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt)
  )
}
