"use client"

import { TrendingUp, Repeat, Minus } from "lucide-react"
import { useExerciseHistory } from "@/hooks/useExerciseHistory"
import { suggestedIncrement } from "@/lib/progressive-overload"
import { adaptiveTarget, type AdaptReason } from "@/lib/adaptive-target"

interface AdaptiveTargetBannerProps {
  exerciseId: string
  /** Prescribed rep range, e.g. "8-12". */
  repsTarget: string | null
  /** Muscle groups — sizes the progression increment. */
  muscleGroups?: string[]
  /** True when "weight" is machine assistance (progress = drop it). */
  assisted?: boolean
  /** True for moves with no loadable equipment — progression is reps. */
  bodyweight?: boolean
}

const style: Record<
  Exclude<AdaptReason, "new">,
  { cls: string; icon: typeof TrendingUp }
> = {
  progress: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: TrendingUp },
  repeat: { cls: "border-gray-200 bg-gray-50 text-gray-700", icon: Repeat },
  hold: { cls: "border-amber-200 bg-amber-50 text-amber-900", icon: Minus },
}

/**
 * Shows the adaptive weight recommendation for the current lift, derived from
 * the last logged session: Progress (+weight), Repeat, or Hold — with a one-
 * line reason. Renders nothing until there's usable history.
 */
export function AdaptiveTargetBanner({
  exerciseId,
  repsTarget,
  muscleGroups,
  assisted = false,
  bodyweight = false,
}: AdaptiveTargetBannerProps) {
  const { data } = useExerciseHistory(exerciseId)

  const target = adaptiveTarget({
    previousSets: (data?.previousSets ?? []).map((s) => ({
      weight: s.weight,
      reps: s.reps,
    })),
    repRange: repsTarget,
    increment: muscleGroups ? suggestedIncrement(muscleGroups) : 5,
    assisted,
    bodyweight,
  })

  if (target.reason === "new") return null

  const s = style[target.reason]
  const Icon = s.icon

  return (
    <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${s.cls}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">
          {target.label}
          {target.weight != null && target.reason !== "progress" && (
            <span className="font-normal"> · {target.weight} lb</span>
          )}
        </p>
        <p className="text-xs opacity-80">{target.note}</p>
      </div>
    </div>
  )
}
