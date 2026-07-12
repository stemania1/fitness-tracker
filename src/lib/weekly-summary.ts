/**
 * Aggregate this week's logged training into a few headline numbers for the
 * dashboard "This Week" card: strength volume (weight × reps), Zone 2 / cardio
 * minutes, working sets, and session count. Pure so it's unit-tested; the
 * Supabase fetch + UUID→catalog bridging lives in the card component.
 */

export type WeekExerciseType = "strength" | "cardio" | "flexibility" | null

export interface WeekSet {
  weight: number | null
  reps: number | null
  durationMins: number | null
}

export interface WeekExercise {
  exerciseType: WeekExerciseType
  sets: WeekSet[]
}

export interface WeekTrainingSummary {
  /** Total weight × reps across strength sets, in lbs. */
  strengthVolumeLbs: number
  /** Total logged minutes across cardio sets (Zone 2 + intervals). */
  cardioMinutes: number
  /** Count of completed strength sets. */
  strengthSets: number
  /** Number of workout sessions this week. */
  sessions: number
}

export function summarizeWeekTraining(
  exercises: WeekExercise[],
  sessions: number
): WeekTrainingSummary {
  let strengthVolumeLbs = 0
  let cardioMinutes = 0
  let strengthSets = 0

  for (const ex of exercises) {
    if (ex.exerciseType === "cardio") {
      for (const s of ex.sets) cardioMinutes += s.durationMins ?? 0
    } else {
      // Strength / flexibility / unknown all count as working sets.
      for (const s of ex.sets) {
        strengthSets += 1
        if (s.weight != null && s.reps != null) {
          strengthVolumeLbs += s.weight * s.reps
        }
      }
    }
  }

  return {
    strengthVolumeLbs: Math.round(strengthVolumeLbs),
    cardioMinutes: Math.round(cardioMinutes),
    strengthSets,
    sessions,
  }
}

/** Compact volume label: 2.7k for 2,650, otherwise the plain number. */
export function formatVolume(lbs: number): string {
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k`
  return `${lbs}`
}
