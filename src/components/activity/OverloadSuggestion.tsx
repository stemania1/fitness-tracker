"use client"

import { TrendingUp } from "lucide-react"
import { useExerciseHistory } from "@/hooks/useExerciseHistory"
import {
  getOverloadSuggestion,
  parseRepRangeTop,
  suggestedIncrement,
} from "@/lib/progressive-overload"

interface OverloadSuggestionProps {
  exerciseId: string
  /** Current exercise's prescribed rep range string, e.g. "8-12". When not
   *  set (freestyle workout), the banner won't render. */
  repsTarget: string | null
  /** Muscle groups for the exercise; sizes the increment (isolation moves
   *  get +2.5, lower-body compounds +10). Falls back to +5 when absent. */
  muscleGroups?: string[]
}

export function OverloadSuggestion({
  exerciseId,
  repsTarget,
  muscleGroups,
}: OverloadSuggestionProps) {
  const { data } = useExerciseHistory(exerciseId)
  const repTop = parseRepRangeTop(repsTarget)
  const suggestion = getOverloadSuggestion(
    (data?.previousSets ?? []).map((s) => ({
      weight: s.weight,
      reps: s.reps,
    })),
    repTop,
    muscleGroups ? suggestedIncrement(muscleGroups) : undefined
  )

  if (!suggestion) return null

  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <div>
        <p className="font-medium">Try +{suggestion.increment} lbs today</p>
        <p className="text-xs text-emerald-700">
          Last session you cleared {suggestion.repTarget}+ reps on every set
          at {suggestion.previousWeight} lbs. Aim for{" "}
          {suggestion.suggestedWeight} lbs.
        </p>
      </div>
    </div>
  )
}
