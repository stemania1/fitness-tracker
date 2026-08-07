"use client"

import { useMemo } from "react"
import { exercises as staticExercises } from "@/data/exercises"
import {
  liveGoalCurrent,
  goalProgressPercent,
  type ExerciseBest,
} from "@/lib/goal-progress"
import dynamic from "next/dynamic"
import { buildGoalTrend, type DatedExerciseRow } from "@/lib/goal-trend"

// Recharts consumer; deferred so the chart library stays out of the goals
// page's first-load bundle. Renders nothing until data warrants a chart, so
// there's no skeleton to show while it loads.
const GoalTrendChart = dynamic(
  () =>
    import("@/components/goals/GoalTrendChart").then((m) => m.GoalTrendChart),
  { ssr: false }
)
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Scale, Dumbbell, Heart, Calendar } from "lucide-react"
import type { UserGoal } from "@/types/database"
import { formatMediumDate } from "@/lib/dates"

const GOAL_TYPE_CONFIG: Record<
  UserGoal["goal_type"],
  { icon: typeof Scale; label: string; color: string }
> = {
  weight: { icon: Scale, label: "Weight", color: "text-blue-600" },
  strength: { icon: Dumbbell, label: "Strength", color: "text-purple-600" },
  endurance: { icon: Heart, label: "Endurance", color: "text-rose-600" },
  consistency: { icon: Calendar, label: "Consistency", color: "text-amber-600" },
}

/**
 * One goal in the "Your Goals" list: live progress, status badge, and — for
 * strength/endurance goals — the per-session trend toward the target.
 */
export function GoalCard({
  goal,
  bests,
  rows,
}: {
  goal: UserGoal
  bests: Map<string, ExerciseBest>
  rows: DatedExerciseRow[]
}) {
  const config = GOAL_TYPE_CONFIG[goal.goal_type]
  const Icon = config.icon
  // Strength/endurance goals derive their current value from logged workouts;
  // weight/consistency fall back to the stored value / their own summaries.
  const isExerciseGoal =
    goal.goal_type === "strength" || goal.goal_type === "endurance"
  const liveCurrent = liveGoalCurrent(goal, bests)

  const trend = useMemo(
    () =>
      isExerciseGoal && goal.exercise_id
        ? buildGoalTrend(
            rows,
            goal.exercise_id,
            goal.goal_type as "strength" | "endurance",
            goal.unit
          )
        : [],
    [rows, goal.exercise_id, goal.goal_type, goal.unit, isExerciseGoal]
  )
  const progress = goalProgressPercent(
    isExerciseGoal ? liveCurrent : goal.current_value ?? 0,
    goal.target_value
  )
  const isAchieved = !!goal.achieved_at || (isExerciseGoal && progress >= 100)

  const exerciseName = goal.exercise_id
    ? staticExercises.find((e) => e.id === goal.exercise_id)?.name
    : undefined

  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 ${config.color}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900">
              {goal.goal_type === "weight"
                ? `Body Weight: ${goal.current_value ?? "?"} ${goal.unit} → ${goal.target_value} ${goal.unit}`
                : goal.goal_type === "consistency"
                  ? `${goal.target_value} workouts per week`
                  : `${exerciseName ? `${exerciseName}: ` : ""}${Math.round(liveCurrent)} ${goal.unit} → ${goal.target_value} ${goal.unit}${goal.goal_type === "strength" ? " est. 1RM" : ""}`}
            </p>
            <Badge variant={isAchieved ? "success" : "default"}>
              {isAchieved ? "Achieved" : "In Progress"}
            </Badge>
          </div>

          <Progress value={progress} />

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{progress}% complete</span>
            {goal.deadline && (
              <span>Due {formatMediumDate(goal.deadline)}</span>
            )}
          </div>

          {/* Progress trend for strength/endurance goals (needs 2+ sessions) */}
          <GoalTrendChart
            points={trend}
            target={goal.target_value}
            unit={goal.unit}
          />
        </div>
      </CardContent>
    </Card>
  )
}
