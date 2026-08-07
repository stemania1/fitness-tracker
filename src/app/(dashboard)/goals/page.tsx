"use client"

import { useState, useMemo } from "react"
import { projectFromRecentLogs } from "@/lib/weight-projection"
import { computeExerciseBests } from "@/lib/goal-progress"
import {
  calcWeeklyStreak,
  calcVolumeByWeek,
  weightGoalPercent,
} from "@/lib/goal-stats"
import { buildMilestoneData } from "@/lib/milestone-data"
import {
  useGoals,
  useWeightLogs,
  useWorkoutLogs,
  useSetLogs,
  useExerciseBests,
} from "@/hooks/useGoalsData"
import { AddGoalModal } from "@/components/goals/AddGoalModal"
import { GoalCard } from "@/components/goals/GoalCard"
import Milestones from "./milestones"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Scale, Dumbbell, Flame, Plus, Target } from "lucide-react"
import { formatShortDate } from "@/lib/dates"
import { useProfile } from "@/hooks/useProfile"

/**
 * Goals & Progress. Composition only: the reads live in hooks/useGoalsData,
 * the derivations in lib (goal-stats, goal-progress, weight-projection,
 * milestone-data), and the interactive pieces in components/goals.
 */
export default function GoalsPage() {
  const [addOpen, setAddOpen] = useState(false)

  const { data: profile } = useProfile()
  const { data: goals, isLoading: goalsLoading } = useGoals()
  const { data: weightLogs } = useWeightLogs()
  const { data: workoutLogs } = useWorkoutLogs()
  const { data: setLogData } = useSetLogs()
  const { data: bestsRows } = useExerciseBests()

  const datedRows = useMemo(() => bestsRows ?? [], [bestsRows])
  const exerciseBests = useMemo(
    () => computeExerciseBests(datedRows),
    [datedRows]
  )

  const targetWorkoutsPerWeek = profile?.workout_days ?? 3

  const weeklyStreak = useMemo(
    () =>
      workoutLogs
        ? calcWeeklyStreak(workoutLogs, targetWorkoutsPerWeek)
        : 0,
    [workoutLogs, targetWorkoutsPerWeek]
  )

  const weightChartData = useMemo(
    () =>
      (weightLogs ?? []).map((w) => ({
        date: formatShortDate(w.logged_at),
        weight: w.weight,
      })),
    [weightLogs]
  )

  const volumeChartData = useMemo(
    () => calcVolumeByWeek((setLogData as never[]) ?? []),
    [setLogData]
  )

  const milestoneData = useMemo(
    () =>
      buildMilestoneData(
        workoutLogs ?? [],
        goals ?? [],
        weeklyStreak
      ),
    [workoutLogs, goals, weeklyStreak]
  )

  // Weight goal summary from profile
  const currentWeight = profile?.current_weight
  const targetWeight = profile?.target_weight

  // Project the target date from the last 60 days of weight logs.
  const projection = useMemo(
    () => projectFromRecentLogs(weightLogs, currentWeight, targetWeight),
    [weightLogs, currentWeight, targetWeight]
  )
  const weightProgress =
    currentWeight && targetWeight
      ? weightGoalPercent(currentWeight, targetWeight, weightLogs?.[0]?.weight)
      : 0

  const hasGoals = (goals ?? []).length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Goals & Progress</h1>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {/* ── Overview Cards ──────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Weight Goal Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-5 w-5 text-blue-600" />
              Weight Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentWeight && targetWeight ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-gray-900">
                    {currentWeight}
                  </span>
                  <span className="text-sm text-gray-500">
                    {"→"} {targetWeight} lbs
                  </span>
                </div>
                <Progress value={weightProgress} />
                <p className="text-xs text-gray-500">
                  {Math.round(Math.abs(currentWeight - targetWeight) * 10) / 10}{" "}
                  lbs to go
                </p>
                {projection?.onTrack ? (
                  <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    <span className="font-medium">
                      On track — about{" "}
                      {projection.daysToTarget > 30
                        ? `${Math.round(projection.daysToTarget / 7)} weeks`
                        : `${projection.daysToTarget} days`}{" "}
                      to go
                    </span>
                    <p className="text-emerald-700">
                      At {Math.abs(projection.lbsPerWeek).toFixed(1)} lbs/week.
                      Target by {projection.projectedDate}.
                    </p>
                    {projection.rapidRate && (
                      <p className="mt-1 text-amber-700">
                        That pace is faster than the generally recommended
                        1-2 lbs/week — make sure it&apos;s intentional and
                        sustainable.
                      </p>
                    )}
                  </div>
                ) : projection?.reason === "too_slow" ? (
                  <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Your weight trend is heading the right way, but at the
                    current rate the target is more than two years out.
                    Small, consistent changes to diet or activity will move
                    the date closer.
                  </div>
                ) : projection && !projection.onTrack ? (
                  <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Recent weight log trend is moving away from your target.
                    Adjust your routine to course-correct.
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Set your weight goal in your profile to track progress.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Weekly Consistency Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-5 w-5 text-orange-500" />
              Weekly Consistency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {weeklyStreak}
                </span>
                <span className="text-sm text-gray-500">
                  week streak
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Target: {targetWorkoutsPerWeek} workouts per week
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Empty State ─────────────────────────────────────── */}
      {!goalsLoading && !hasGoals && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900">
              Set Your First Goal
            </h3>
            <p className="mb-6 max-w-sm text-sm text-gray-500">
              Create goals to track your fitness progress. Whether it is losing
              weight, getting stronger, or building a workout habit — stay
              motivated with clear targets.
            </p>
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Goal
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Goals List ──────────────────────────────────────── */}
      {hasGoals && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Your Goals</h2>
          <div className="space-y-3">
            {goals!.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                bests={exerciseBests}
                rows={datedRows}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Charts ──────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weight Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-5 w-5 text-blue-600" />
              Weight Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weightChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weightChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    domain={["dataMin - 5", "dataMax + 5"]}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#7c3aed" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
                No weight logs yet. Log your weight to see trends.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Volume Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Dumbbell className="h-5 w-5 text-purple-600" />
              Volume Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {volumeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={volumeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <Tooltip />
                  <Bar
                    dataKey="volume"
                    fill="#7c3aed"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
                No workout data yet. Complete workouts to see volume trends.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Milestones ──────────────────────────────────────── */}
      <Milestones data={milestoneData} />

      {/* ── Add Goal Modal ──────────────────────────────────── */}
      <AddGoalModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
