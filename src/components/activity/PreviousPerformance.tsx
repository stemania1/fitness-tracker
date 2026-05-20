"use client"

import { useExerciseHistory } from "@/hooks/useExerciseHistory"
import {
  formatCardioSets,
  formatStrengthSets,
} from "./previous-performance-format"

interface PreviousPerformanceProps {
  exerciseId: string
  exerciseType: "strength" | "cardio" | "flexibility"
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
