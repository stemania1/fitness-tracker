import type { PreviousSetRow } from "@/hooks/useExerciseHistory"

/**
 * Render previous strength sets as a comma-separated "{weight} × {reps}"
 * list. Null weight is rendered as "BW" (bodyweight); null reps as "?".
 */
export function formatStrengthSets(sets: PreviousSetRow[]): string {
  return sets
    .map((s) => {
      const weight = s.weight != null ? `${s.weight} lbs` : "BW"
      const reps = s.reps != null ? `${s.reps}` : "?"
      return `${weight} × ${reps}`
    })
    .join(", ")
}

/**
 * Render previous cardio sets as totals across all sets. Returns an empty
 * string when neither total is positive (which the caller can use as a
 * "nothing to show" signal).
 */
export function formatCardioSets(sets: PreviousSetRow[]): string {
  const parts: string[] = []
  const totalMins = sets.reduce((sum, s) => sum + (s.duration_mins ?? 0), 0)
  const totalDist = sets.reduce(
    (sum, s) => sum + (s.distance_miles ?? 0),
    0
  )
  if (totalMins > 0) parts.push(`${totalMins} min`)
  if (totalDist > 0) parts.push(`${totalDist} mi`)
  return parts.join(", ")
}
