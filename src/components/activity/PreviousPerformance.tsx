"use client"

import { useExerciseHistory, type PreviousSetRow } from "@/hooks/useExerciseHistory"

interface PreviousPerformanceProps {
  exerciseId: string
  exerciseType: "strength" | "cardio" | "flexibility"
}

function formatStrengthSets(sets: PreviousSetRow[]): string {
  return sets
    .map((s) => {
      const weight = s.weight != null ? `${s.weight} lbs` : "BW"
      const reps = s.reps != null ? `${s.reps}` : "?"
      return `${weight} × ${reps}`
    })
    .join(", ")
}

function formatCardioSets(sets: PreviousSetRow[]): string {
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

export function PreviousPerformance({
  exerciseId,
  exerciseType,
}: PreviousPerformanceProps) {
  const { data, isLoading } = useExerciseHistory(exerciseId)

  if (isLoading) {
    return (
      <p className="mt-1 text-xs text-gray-400">Loading previous...</p>
    )
  }

  const sets = data?.previousSets ?? []
  if (sets.length === 0) {
    return null
  }

  const formatted =
    exerciseType === "cardio"
      ? formatCardioSets(sets)
      : formatStrengthSets(sets)

  return (
    <p className="mt-1 text-xs text-gray-400">
      Last: {formatted}
    </p>
  )
}
