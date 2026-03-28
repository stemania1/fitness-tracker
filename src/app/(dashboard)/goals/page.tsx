"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { exercises as staticExercises } from "@/data/exercises"
import Milestones, { type MilestoneData } from "./milestones"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import {
  Scale,
  Dumbbell,
  Heart,
  Calendar,
  Flame,
  Trophy,
  Plus,
  Target,
} from "lucide-react"
import type { UserGoal, UserProfile } from "@/types/database"

const supabase = createClient()

type GoalType = "weight" | "strength" | "endurance" | "consistency"

const GOAL_TYPE_CONFIG: Record<
  GoalType,
  { icon: typeof Scale; label: string; color: string }
> = {
  weight: { icon: Scale, label: "Weight", color: "text-blue-600" },
  strength: { icon: Dumbbell, label: "Strength", color: "text-purple-600" },
  endurance: { icon: Heart, label: "Endurance", color: "text-rose-600" },
  consistency: { icon: Calendar, label: "Consistency", color: "text-amber-600" },
}

function goalProgress(goal: UserGoal): number {
  const current = goal.current_value ?? 0
  const target = goal.target_value
  if (target === 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatChartDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  )
  return `W${weekNum}`
}

// ─── Data fetching ─────────────────────────────────────────────

async function getAuthUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single()
      if (error) throw error
      return data as UserProfile
    },
  })
}

function useGoals() {
  return useQuery({
    queryKey: ["user-goals"],
    queryFn: async () => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("user_goals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as UserGoal[]
    },
  })
}

function useWeightLogs() {
  return useQuery({
    queryKey: ["weight-logs"],
    queryFn: async () => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("weight_logs")
        .select("*")
        .eq("user_id", userId)
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data
    },
  })
}

function useWorkoutLogs() {
  return useQuery({
    queryKey: ["workout-logs-all"],
    queryFn: async () => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, started_at, finished_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: true })
      if (error) throw error
      return data
    },
  })
}

function useSetLogs() {
  return useQuery({
    queryKey: ["set-logs-all"],
    queryFn: async () => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("workout_logs")
        .select("started_at, exercise_logs(set_logs(weight, reps))")
        .eq("user_id", userId)
        .order("started_at", { ascending: true })
      if (error) throw error
      return data
    },
  })
}

// ─── Weekly streak calculation ──────────────────────────────────

function calcWeeklyStreak(
  workoutLogs: { started_at: string }[],
  targetPerWeek: number
): number {
  if (!workoutLogs.length || targetPerWeek <= 0) return 0

  // Group workouts by ISO week
  const weekMap = new Map<string, number>()
  for (const log of workoutLogs) {
    const d = new Date(log.started_at)
    const yearWeek = `${d.getFullYear()}-${getWeekLabel(log.started_at)}`
    weekMap.set(yearWeek, (weekMap.get(yearWeek) ?? 0) + 1)
  }

  // Get sorted weeks
  const sortedWeeks = [...weekMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  // Count consecutive weeks from the most recent that hit the target
  let streak = 0
  for (let i = sortedWeeks.length - 1; i >= 0; i--) {
    if (sortedWeeks[i][1] >= targetPerWeek) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ─── Volume chart data ──────────────────────────────────────────

interface VolumeWeek {
  week: string
  volume: number
}

function calcVolumeByWeek(
  setLogData: {
    started_at: string
    exercise_logs: { set_logs: { weight: number | null; reps: number | null }[] }[]
  }[]
): VolumeWeek[] {
  const weekMap = new Map<string, number>()

  for (const workout of setLogData) {
    const week = getWeekLabel(workout.started_at)
    let vol = weekMap.get(week) ?? 0
    for (const ex of workout.exercise_logs) {
      for (const s of ex.set_logs) {
        if (s.weight && s.reps) {
          vol += s.weight * s.reps
        }
      }
    }
    weekMap.set(week, vol)
  }

  return [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, volume]) => ({ week, volume }))
}

// ─── Milestone data builder ─────────────────────────────────────

function buildMilestoneData(
  workoutLogs: { started_at: string }[],
  goals: UserGoal[],
  streakLength: number
): MilestoneData {
  const sorted = [...workoutLogs].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  )

  const achievedGoals = goals.filter((g) => g.achieved_at)

  return {
    workoutCount: workoutLogs.length,
    firstWorkoutDate: sorted[0]?.started_at ?? null,
    tenthWorkoutDate: sorted[9]?.started_at ?? null,
    hasNewPR: false, // determined externally if needed
    prDate: null,
    goalsAchievedCount: achievedGoals.length,
    firstGoalAchievedDate: achievedGoals[0]?.achieved_at ?? null,
    streakLength,
    fourWeekStreakDate: streakLength >= 4 ? new Date().toISOString() : null,
  }
}

// ─── Add Goal Modal ─────────────────────────────────────────────

interface AddGoalFormState {
  goalType: GoalType
  exerciseId: string
  targetValue: string
  deadline: string
}

const initialFormState: AddGoalFormState = {
  goalType: "weight",
  exerciseId: "",
  targetValue: "",
  deadline: "",
}

function unitForGoalType(goalType: GoalType): string {
  switch (goalType) {
    case "weight":
      return "lbs"
    case "strength":
      return "lbs"
    case "endurance":
      return "mins"
    case "consistency":
      return "workouts/week"
  }
}

function AddGoalModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<AddGoalFormState>(initialFormState)

  const strengthExercises = staticExercises.filter(
    (e) => e.exerciseType === "strength"
  )
  const cardioExercises = staticExercises.filter(
    (e) => e.exerciseType === "cardio"
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const userId = await getAuthUserId()
      const targetValue = parseFloat(form.targetValue)
      if (isNaN(targetValue) || targetValue <= 0) {
        throw new Error("Target value must be a positive number")
      }

      const insert: Record<string, unknown> = {
        user_id: userId,
        goal_type: form.goalType,
        target_value: targetValue,
        current_value: 0,
        unit: unitForGoalType(form.goalType),
      }

      if (
        (form.goalType === "strength" || form.goalType === "endurance") &&
        form.exerciseId
      ) {
        insert.exercise_id = form.exerciseId
      }

      if (form.deadline) {
        insert.deadline = form.deadline
      }

      const { error } = await supabase.from("user_goals").insert(insert as any)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-goals"] })
      setForm(initialFormState)
      onOpenChange(false)
    },
  })

  const exerciseList =
    form.goalType === "strength"
      ? strengthExercises
      : form.goalType === "endurance"
        ? cardioExercises
        : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Goal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Goal type */}
          <div className="space-y-2">
            <Label htmlFor="goal-type">Goal Type</Label>
            <Select
              id="goal-type"
              value={form.goalType}
              onChange={(e) =>
                setForm({
                  ...form,
                  goalType: e.target.value as GoalType,
                  exerciseId: "",
                })
              }
            >
              <option value="weight">Weight</option>
              <option value="strength">Strength</option>
              <option value="endurance">Endurance</option>
              <option value="consistency">Consistency</option>
            </Select>
          </div>

          {/* Exercise picker for strength / endurance */}
          {(form.goalType === "strength" || form.goalType === "endurance") && (
            <div className="space-y-2">
              <Label htmlFor="exercise">Exercise</Label>
              <Select
                id="exercise"
                value={form.exerciseId}
                onChange={(e) =>
                  setForm({ ...form, exerciseId: e.target.value })
                }
              >
                <option value="">Select exercise...</option>
                {exerciseList.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Target value */}
          <div className="space-y-2">
            <Label htmlFor="target-value">
              Target{" "}
              <span className="text-gray-400">
                ({unitForGoalType(form.goalType)})
              </span>
            </Label>
            <Input
              id="target-value"
              type="number"
              min="0"
              step="any"
              placeholder={
                form.goalType === "weight"
                  ? "e.g. 180"
                  : form.goalType === "strength"
                    ? "e.g. 185"
                    : form.goalType === "endurance"
                      ? "e.g. 30"
                      : "e.g. 4"
              }
              value={form.targetValue}
              onChange={(e) =>
                setForm({ ...form, targetValue: e.target.value })
              }
            />
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="deadline">
              Deadline{" "}
              <span className="text-gray-400">(optional)</span>
            </Label>
            <Input
              id="deadline"
              type="date"
              value={form.deadline}
              onChange={(e) =>
                setForm({ ...form, deadline: e.target.value })
              }
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">
              {(mutation.error as Error).message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.targetValue}
          >
            {mutation.isPending ? "Saving..." : "Save Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Goal Card ──────────────────────────────────────────────────

function GoalCard({ goal }: { goal: UserGoal }) {
  const config = GOAL_TYPE_CONFIG[goal.goal_type]
  const Icon = config.icon
  const progress = goalProgress(goal)
  const isAchieved = !!goal.achieved_at

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
                ? `Body Weight: ${goal.current_value ?? "?"} ${goal.unit} \u2192 ${goal.target_value} ${goal.unit}`
                : goal.goal_type === "consistency"
                  ? `${goal.target_value} workouts per week`
                  : `${goal.current_value ?? 0} ${goal.unit} \u2192 ${goal.target_value} ${goal.unit}`}
            </p>
            <Badge variant={isAchieved ? "success" : "default"}>
              {isAchieved ? "Achieved" : "In Progress"}
            </Badge>
          </div>

          <Progress value={progress} />

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{progress}% complete</span>
            {goal.deadline && (
              <span>Due {formatDate(goal.deadline)}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ──────────────────────────────────────────────────

export default function GoalsPage() {
  const [addOpen, setAddOpen] = useState(false)

  const { data: profile } = useProfile()
  const { data: goals, isLoading: goalsLoading } = useGoals()
  const { data: weightLogs } = useWeightLogs()
  const { data: workoutLogs } = useWorkoutLogs()
  const { data: setLogData } = useSetLogs()

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
        date: formatChartDate(w.logged_at),
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
  const weightProgress =
    currentWeight && targetWeight
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((currentWeight - (weightLogs?.[0]?.weight ?? currentWeight)) /
                ((targetWeight - (weightLogs?.[0]?.weight ?? currentWeight)) || 1)) *
                100
            )
          )
        )
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
                    {"\u2192"} {targetWeight} lbs
                  </span>
                </div>
                <Progress value={weightProgress} />
                <p className="text-xs text-gray-500">
                  {Math.abs(currentWeight - targetWeight)} lbs to go
                </p>
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
              <GoalCard key={goal.id} goal={goal} />
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
