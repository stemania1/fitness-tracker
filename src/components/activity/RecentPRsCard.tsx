"use client"

import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy } from "lucide-react"
import {
  estimateOneRepMax,
  findRecentPRs,
  findRecentRepPRs,
} from "@/lib/personal-records"
import { useStrengthSets } from "@/hooks/useStrengthSets"
import { formatShortDate } from "@/lib/dates"
import { CARD_ACCENTS } from "@/lib/constants"

/**
 * New weight and rep records from the last 30 days. Combines weight and rep
 * PRs into one chronological feed; when an exercise set both in the window,
 * only the weight PR is kept — it's strictly more impressive.
 */
export function RecentPRsCard() {
  const { data: allStrengthSets, isLoading } = useStrengthSets()

  const recentPRs = useMemo(() => {
    if (!allStrengthSets) return []
    const weightPRs = findRecentPRs(allStrengthSets, 30).map((pr) => ({
      kind: "weight" as const,
      ...pr,
    }))
    const weightPRExercises = new Set(weightPRs.map((p) => p.exerciseName))
    const repPRs = findRecentRepPRs(allStrengthSets, 30)
      .filter((pr) => !weightPRExercises.has(pr.exerciseName))
      .map((pr) => ({ kind: "rep" as const, ...pr }))
    return [...weightPRs, ...repPRs]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 5)
  }, [allStrengthSets])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className={`h-5 w-5 ${CARD_ACCENTS.progress}`} />
          Recent PRs
        </CardTitle>
        <p className="text-xs text-gray-500">
          New weight and rep records from the last 30 days
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : recentPRs.length > 0 ? (
          <div className="space-y-2">
            {recentPRs.map((pr) => {
              // Epley e1RM is load-based and meaningless when the weight is
              // assistance, so skip it for assisted exercises.
              const e1rm = pr.assisted
                ? null
                : estimateOneRepMax(pr.weight, pr.reps)
              const date = formatShortDate(pr.startedAt)
              return (
                <div
                  key={`${pr.kind}-${pr.exerciseName}-${pr.startedAt}`}
                  className="flex items-center justify-between rounded-lg bg-amber-50 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {pr.exerciseName}
                      </p>
                      <span
                        className={
                          pr.kind === "weight"
                            ? "rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900"
                            : "rounded-full bg-purple-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-900"
                        }
                      >
                        {pr.kind === "weight" ? "Weight" : "Reps"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {date}
                      {pr.kind === "weight" &&
                        pr.previousMaxWeight != null && (
                          <>
                            {" "}· prev {pr.previousMaxWeight} lbs
                            {pr.assisted ? " assist" : ""}
                          </>
                        )}
                      {pr.kind === "rep" &&
                        pr.previousMaxReps != null && (
                          <> · prev {pr.previousMaxReps} reps</>
                        )}
                      {e1rm != null && <> · est. 1RM {Math.round(e1rm)} lbs</>}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {pr.weight} lbs{pr.assisted ? " assist" : ""} × {pr.reps}
                  </Badge>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-gray-500">
            No new PRs in the last 30 days. Time to chase one!
          </div>
        )}
      </CardContent>
    </Card>
  )
}
