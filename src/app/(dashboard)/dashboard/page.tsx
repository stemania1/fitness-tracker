"use client"

import { useMemo, useCallback } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dumbbell,
  Scale,
  Trophy,
  Flame,
  Plus,
  ChevronRight,
  Moon,
  Heart,
  Activity,
  Zap,
  Wind,
  Brain,
  Shield,
  TrendingUp,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts"
import { exercises as exerciseCatalog } from "@/data/exercises"
import { estimateStrengthCalories, estimateCardioCalories } from "@/lib/calories"
import {
  estimateOneRepMax,
  findRecentPRs,
  findRecentRepPRs,
  type SetWithMeta,
} from "@/lib/personal-records"
import {
  buildWeeklyVolumeTrend,
  shouldSuggestDeload,
} from "@/lib/volume-trend"
import type { OuraSummary } from "@/lib/oura"
import { formatSleepDuration } from "@/lib/oura"
import { generateInsights } from "@/lib/oura-insights"
import { zoneRange, classifyHeartRate } from "@/lib/heart-rate"
import { macroTargets } from "@/lib/macro-targets"
import type { OuraInsight } from "@/lib/oura-insights"
import { QuickLogExercise } from "@/components/activity/QuickLogExercise"
import { QuickLogStrength } from "@/components/activity/QuickLogStrength"
import { QuickLogWeight } from "@/components/activity/QuickLogWeight"
import { Vo2MaxTrendCard } from "@/components/activity/Vo2MaxTrendCard"
import { TrainingPlanTodayCard } from "@/components/activity/TrainingPlanTodayCard"
import { WeeklyTrainingCard } from "@/components/activity/WeeklyTrainingCard"
import { todaysWorkout } from "@/lib/todays-workout"
import { RemInsightsCard } from "@/components/activity/RemInsightsCard"
import { RecoveryWatchCard } from "@/components/activity/RecoveryWatchCard"
import { QuickLogFood } from "@/components/activity/QuickLogFood"
import { NutritionCard } from "@/components/activity/NutritionCard"
import { RingBatteryIndicator } from "@/components/activity/RingBatteryIndicator"
import { ErrorBoundary } from "@/components/ui/error-boundary"

const supabase = createClient()

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  )
  return `W${weekNum}`
}

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

function getStartOfWeek() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

const insightIconMap: Record<OuraInsight["icon"], typeof Heart> = {
  dumbbell: Dumbbell,
  moon: Moon,
  zap: Zap,
  flame: Flame,
  heart: Heart,
  brain: Brain,
  shield: Shield,
  wind: Wind,
  "trending-up": TrendingUp,
}

const insightPriorityColors: Record<OuraInsight["priority"], string> = {
  high: "border-l-amber-500 bg-amber-50",
  medium: "border-l-blue-400 bg-blue-50",
  low: "border-l-emerald-400 bg-emerald-50",
}

function OuraInsightRow({ insight }: { insight: OuraInsight }) {
  const Icon = insightIconMap[insight.icon]
  return (
    <div className={`rounded-lg border-l-4 p-3 ${insightPriorityColors[insight.priority]}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
        <div>
          <p className="text-sm font-medium text-gray-900">{insight.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{insight.body}</p>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      if (error) throw error
      return data
    },
  })

  const weekStart = useMemo(() => getStartOfWeek(), [])

  // Start Workout opens the day's session in the logger (weights + previous
  // performance) on training days; rest days go to the lightweight rest screen.
  const startWorkoutHref = useMemo(
    () =>
      todaysWorkout(new Date()).isRest
        ? "/activity/today"
        : "/activity/log?plan=today",
    []
  )

  const { data: weeklyWorkouts, isLoading: weeklyLoading } = useQuery({
    queryKey: ["weekly-workouts", weekStart],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("user_id", user.id)
        .gte("started_at", weekStart)
      if (error) throw error
      return data
    },
  })

  const { data: allWorkoutLogs, isLoading: allWorkoutsLoading } = useQuery({
    queryKey: ["workout-logs-all"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, started_at")
        .eq("user_id", user.id)
        .order("started_at", { ascending: true })
      if (error) throw error
      return data
    },
  })

  const { data: recentWorkouts, isLoading: recentLoading } = useQuery({
    queryKey: ["recent-workouts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, name, started_at, duration_mins")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(3)
      if (error) throw error
      return data
    },
  })

  const { data: weightLogs, isLoading: weightLoading } = useQuery({
    queryKey: ["weight-logs-recent"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("weight_logs")
        .select("weight, logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: true })
        .limit(30)
      if (error) throw error
      return data ?? []
    },
  })

  const latestWeight = weightLogs?.length ? weightLogs[weightLogs.length - 1] : null

  const weightChartData = useMemo(
    () =>
      (weightLogs ?? []).map((w) => ({
        date: new Date(w.logged_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        weight: w.weight,
      })),
    [weightLogs]
  )

  const weightDomain = useMemo(() => {
    const weights = (weightLogs ?? []).map((w) => w.weight)
    const target = profile?.target_weight
    if (target) weights.push(target)
    if (weights.length === 0) return undefined
    const min = Math.min(...weights)
    const max = Math.max(...weights)
    const padding = Math.max(3, Math.round((max - min) * 0.15))
    return [Math.floor(min - padding), Math.ceil(max + padding)]
  }, [weightLogs, profile?.target_weight])

  const CustomTooltip = useCallback(
    ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
      if (!active || !payload?.length) return null
      return (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm">
          <span className="font-semibold text-gray-900">{payload[0].value}</span>{" "}
          <span className="text-gray-500">lbs</span>
        </div>
      )
    },
    []
  )

  const exerciseNameMap = useMemo(
    () => new Map(exerciseCatalog.map((e) => [e.name.toLowerCase(), e])),
    []
  )

  const { data: weeklyCalories, isLoading: caloriesLoading } = useQuery({
    queryKey: ["weekly-calories", weekStart],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Get user weight + profile fields for the RMR calorie correction
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("current_weight, age, sex, height_inches")
        .eq("id", user.id)
        .single()
      const weightLbs = prof?.current_weight ?? 170
      const calorieProfile = {
        age: prof?.age,
        sex: prof?.sex,
        heightInches: prof?.height_inches,
      }

      // Get this week's workout IDs
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("user_id", user.id)
        .gte("started_at", weekStart)

      if (!logs || logs.length === 0) return 0

      const logIds = logs.map((l) => l.id)

      // Get exercise logs
      const { data: exLogs } = await supabase
        .from("exercise_logs")
        .select("id, exercise_id")
        .in("workout_log_id", logIds)

      if (!exLogs || exLogs.length === 0) return 0

      const exIds = exLogs.map((e) => e.id)
      const exerciseUuids = [...new Set(exLogs.map((e) => e.exercise_id))]

      // Fetch exercise names from DB to bridge UUIDs to the static catalog
      const { data: dbExercises } = await supabase
        .from("exercises")
        .select("id, name")
        .in("id", exerciseUuids)

      const uuidToName = new Map<string, string>(
        (dbExercises ?? []).map((e) => [e.id as string, e.name as string])
      )

      // Get set logs
      const { data: setLogs } = await supabase
        .from("set_logs")
        .select("exercise_log_id, reps, weight, duration_mins")
        .in("exercise_log_id", exIds)

      // Group sets by exercise log
      const setsByEx = new Map<string, typeof setLogs>()
      setLogs?.forEach((s) => {
        const list = setsByEx.get(s.exercise_log_id) ?? []
        list.push(s)
        setsByEx.set(s.exercise_log_id, list)
      })

      let totalCal = 0
      exLogs.forEach((ex) => {
        const name = uuidToName.get(ex.exercise_id)
        const def = name ? exerciseNameMap.get(name.toLowerCase()) : undefined
        const sets = setsByEx.get(ex.id) ?? []
        const catalogId = def?.id ?? ex.exercise_id
        if (def?.exerciseType === "cardio") {
          const totalMins = sets.reduce((s, set) => s + (set.duration_mins ?? 0), 0)
          totalCal += estimateCardioCalories(
            catalogId,
            totalMins,
            weightLbs,
            null,
            null,
            calorieProfile
          )
        } else {
          totalCal += estimateStrengthCalories(
            catalogId,
            sets.length,
            weightLbs,
            calorieProfile
          )
        }
      })

      return totalCal
    },
  })

  // Oura Ring daily summary
  const { data: ouraResult, isLoading: ouraLoading } = useQuery<{
    connected: boolean
    summary: OuraSummary | null
    error?: string
  }>({
    queryKey: ["oura-summary"],
    queryFn: async () => {
      const localDate = new Date().toLocaleDateString("en-CA") // YYYY-MM-DD in local tz
      const offsetMin = new Date().getTimezoneOffset() // e.g. 240 for EDT (UTC-4)
      const sign = offsetMin <= 0 ? "+" : "-"
      const absMin = Math.abs(offsetMin)
      const tzOffset = `${sign}${String(Math.floor(absMin / 60)).padStart(2, "0")}:${String(absMin % 60).padStart(2, "0")}`
      const res = await fetch(`/api/oura?date=${localDate}&tz_offset=${encodeURIComponent(tzOffset)}`)
      if (res.status === 404) return { connected: false, summary: null }
      if (res.status === 401) return { connected: true, summary: null, error: "token_expired" }
      if (!res.ok) return { connected: true, summary: null, error: "fetch_failed" }
      const summary = (await res.json()) as OuraSummary
      return { connected: true, summary }
    },
    retry: false,
  })

  const ouraSummary = ouraResult?.summary ?? null
  const ouraConnected = ouraResult?.connected ?? false

  // Zone 2-3 band for the heart-rate chart (moderate-effort target).
  const moderateZone = useMemo(
    () => zoneRange(profile?.age ?? null, 2, 3),
    [profile?.age]
  )

  // Recommended daily calorie/macro targets for the nutrition card.
  const nutritionTargets = useMemo(() => macroTargets(profile), [profile])

  const ouraInsights = useMemo(
    () =>
      ouraSummary
        ? generateInsights(ouraSummary, {
            age: profile?.age ?? null,
            sex: profile?.sex ?? null,
          })
        : [],
    [ouraSummary, profile?.age, profile?.sex]
  )

  // All strength sets the user has ever logged. Used to derive both the
  // recent PRs and the weekly volume trend without firing extra queries.
  const { data: allStrengthSets, isLoading: strengthSetsLoading } = useQuery({
    queryKey: ["all-strength-sets"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("set_logs")
        .select(`
          weight,
          reps,
          exercise_log:exercise_logs!inner(
            exercise:exercises!inner(name, exercise_type),
            workout_log:workout_logs!inner(user_id, started_at)
          )
        `)
        .eq("exercise_log.workout_log.user_id", user.id)
        .eq("exercise_log.exercise.exercise_type", "strength")
        .not("weight", "is", null)
      if (error) throw error
      type Row = {
        weight: number | null
        reps: number | null
        exercise_log: {
          exercise: { name: string }
          workout_log: { started_at: string }
        } | null
      }
      const rows = (data ?? []) as unknown as Row[]
      return rows
        .map((r) => ({
          exerciseName: r.exercise_log?.exercise?.name ?? "",
          weight: r.weight,
          reps: r.reps,
          startedAt: r.exercise_log?.workout_log?.started_at ?? "",
        }))
        .filter((s) => s.exerciseName && s.startedAt)
    },
  })

  // Combine weight and rep PRs into a single chronological feed. When an
  // exercise has both a weight PR and a rep PR in the window, keep only
  // the weight PR — it's strictly more impressive.
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

  const volumeTrend = useMemo(
    () => buildWeeklyVolumeTrend(allStrengthSets ?? [], 8),
    [allStrengthSets]
  )

  const deloadSuggestion = useMemo(
    () =>
      shouldSuggestDeload(
        volumeTrend.map((v) => v.volume),
        ouraSummary?.readiness?.score
      ),
    [volumeTrend, ouraSummary?.readiness?.score]
  )

  const weeklyStreak = useMemo(
    () =>
      allWorkoutLogs
        ? calcWeeklyStreak(allWorkoutLogs, profile?.workout_days ?? 4)
        : 0,
    [allWorkoutLogs, profile?.workout_days]
  )

  const workoutTarget = profile?.workout_days ?? 4
  const completedWorkouts = weeklyWorkouts?.length ?? 0
  const weeklyProgress = workoutTarget > 0
    ? Math.round((completedWorkouts / workoutTarget) * 100)
    : 0

  const greeting = profile?.display_name
    ? `Welcome, ${profile.display_name}!`
    : "Welcome back!"

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        {profileLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <Link
          href={startWorkoutHref}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Start Workout
        </Link>
        <div className="flex gap-2">
          <QuickLogStrength />
          <QuickLogExercise />
          <QuickLogWeight />
        </div>
        <div className="flex gap-2">
          <QuickLogFood />
        </div>
      </div>

      {/* Today's prescribed session from the 12-week training plan,
          readiness-gated when Oura data is available */}
      <ErrorBoundary>
        <TrainingPlanTodayCard readinessScore={ouraSummary?.readiness?.score} />
      </ErrorBoundary>

      {/* Photo-logged meals: calories in, macros, net vs Oura calories out */}
      <ErrorBoundary>
        <NutritionCard
          caloriesBurnedToday={ouraSummary?.activity?.total_calories}
          targets={nutritionTargets}
        />
      </ErrorBoundary>

      {/* This Week */}
      <ErrorBoundary>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-5 w-5 text-orange-500" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyLoading || profileLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-gray-600">
                      <span className="text-lg font-semibold text-gray-900">
                        {completedWorkouts}
                      </span>{" "}
                      of {workoutTarget} workouts
                    </span>
                    <span className="text-sm font-medium text-purple-600">
                      {weeklyProgress}%
                    </span>
                  </div>
                  <Progress value={weeklyProgress} />
                </div>
                {!caloriesLoading && weeklyCalories != null && weeklyCalories > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">
                        {weeklyCalories.toLocaleString()}
                      </span>{" "}
                      calories burned
                    </span>
                  </div>
                )}
                {!allWorkoutsLoading && weeklyStreak >= 1 && (
                  <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">
                        {weeklyStreak}
                      </span>{" "}
                      week streak
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </ErrorBoundary>

      {/* Weekly strength volume + Zone 2 minutes */}
      <ErrorBoundary>
        <WeeklyTrainingCard />
      </ErrorBoundary>

      {/* Oura Ring Summary */}
      <ErrorBoundary>
      {!ouraLoading && ouraConnected && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-teal-500" />
                Today&apos;s Oura Summary
              </CardTitle>
              <RingBatteryIndicator battery={ouraSummary?.ringBattery ?? null} />
            </div>
          </CardHeader>
          <CardContent>
            {ouraResult?.error === "token_expired" ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Heart className="h-6 w-6 text-red-300" />
                <p className="text-sm text-gray-500">
                  Your Oura Ring session has expired.
                </p>
                <p className="text-xs text-gray-400">
                  Go to <a href="/profile" className="text-purple-600 underline hover:text-purple-700">Profile</a> to reconnect your ring.
                </p>
              </div>
            ) : ouraResult?.error ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Activity className="h-6 w-6 text-gray-300" />
                <p className="text-sm text-gray-500">
                  Unable to fetch Oura data right now.
                </p>
                <p className="text-xs text-gray-400">
                  This is usually temporary — try refreshing the page.
                </p>
              </div>
            ) : ouraSummary && (ouraSummary.sleep || ouraSummary.sleepPeriod || ouraSummary.activity || ouraSummary.readiness || ouraSummary.restingHeartRate || ouraSummary.spo2 || ouraSummary.stress || ouraSummary.resilience || ouraSummary.vo2Max) ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Sleep */}
                  {(ouraSummary.sleep || ouraSummary.sleepPeriod) && (
                    <div className="rounded-lg bg-indigo-50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600">
                        <Moon className="h-3.5 w-3.5" />
                        Sleep
                      </div>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {ouraSummary.sleep?.score ?? "--"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {ouraSummary.sleepPeriod?.total_sleep_duration
                          ? formatSleepDuration(ouraSummary.sleepPeriod.total_sleep_duration)
                          : "No duration data"}
                      </p>
                      {ouraSummary.sleepPeriod && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {ouraSummary.sleepPeriod.average_hrv != null && `HRV ${ouraSummary.sleepPeriod.average_hrv}ms`}
                          {ouraSummary.sleepPeriod.average_hrv != null && ouraSummary.sleepPeriod.lowest_heart_rate != null && " · "}
                          {ouraSummary.sleepPeriod.lowest_heart_rate != null && `Low HR ${ouraSummary.sleepPeriod.lowest_heart_rate}`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Readiness */}
                  {ouraSummary.readiness && (
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <Zap className="h-3.5 w-3.5" />
                        Readiness
                      </div>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {ouraSummary.readiness.score ?? "--"}
                      </p>
                      <p className="text-xs text-gray-500">Recovery score</p>
                      {ouraSummary.readiness.temperature_deviation != null && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          Temp {ouraSummary.readiness.temperature_deviation > 0 ? "+" : ""}
                          {ouraSummary.readiness.temperature_deviation.toFixed(1)}°
                        </p>
                      )}
                    </div>
                  )}

                  {/* Activity */}
                  {ouraSummary.activity && (
                    <div className="rounded-lg bg-orange-50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600">
                        <Flame className="h-3.5 w-3.5" />
                        Activity
                      </div>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {ouraSummary.activity.active_calories?.toLocaleString() ?? "--"}
                      </p>
                      <p className="text-xs text-gray-500">
                        Active cal &middot; {ouraSummary.activity.steps?.toLocaleString() ?? 0} steps
                      </p>
                    </div>
                  )}

                  {/* Heart Rate */}
                  {ouraSummary.restingHeartRate && (
                    <div className="rounded-lg bg-red-50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                        <Heart className="h-3.5 w-3.5" />
                        Avg Heart Rate
                      </div>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {ouraSummary.restingHeartRate}
                      </p>
                      <p className="text-xs text-gray-500">bpm</p>
                    </div>
                  )}

                  {/* Blood Oxygen */}
                  {ouraSummary.spo2?.spo2_percentage?.average != null && (
                    <div className="rounded-lg bg-sky-50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-sky-600">
                        <Wind className="h-3.5 w-3.5" />
                        Blood Oxygen
                      </div>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {ouraSummary.spo2.spo2_percentage.average}%
                      </p>
                      <p className="text-xs text-gray-500">SpO2 average</p>
                    </div>
                  )}

                  {/* Stress */}
                  {ouraSummary.stress?.day_summary && (
                    <div className="rounded-lg bg-violet-50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-violet-600">
                        <Brain className="h-3.5 w-3.5" />
                        Stress
                      </div>
                      <p className="mt-1 text-lg font-bold capitalize text-gray-900">
                        {ouraSummary.stress.day_summary}
                      </p>
                      <p className="text-xs text-gray-500">
                        {ouraSummary.stress.recovery_high != null
                          ? `${Math.round(ouraSummary.stress.recovery_high / 60)}min recovery`
                          : "Daily summary"}
                      </p>
                    </div>
                  )}

                  {/* Resilience */}
                  {ouraSummary.resilience?.level && (
                    <div className="rounded-lg bg-teal-50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-teal-600">
                        <Shield className="h-3.5 w-3.5" />
                        Resilience
                      </div>
                      <p className="mt-1 text-lg font-bold capitalize text-gray-900">
                        {ouraSummary.resilience.level}
                      </p>
                      <p className="text-xs text-gray-500">Recovery capacity</p>
                    </div>
                  )}

                  {/* VO2 Max */}
                  {ouraSummary.vo2Max != null && (
                    <div className="rounded-lg bg-cyan-50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-600">
                        <TrendingUp className="h-3.5 w-3.5" />
                        VO2 Max
                      </div>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {ouraSummary.vo2Max.toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500">ml/kg/min</p>
                    </div>
                  )}
                </div>

                {/* Heart Rate Timeline */}
                {ouraSummary.heartRateReadings.length > 0 && (
                  <div className="rounded-lg border border-gray-100 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <Heart className="h-3.5 w-3.5 text-red-400" />
                      Heart Rate Today
                      {moderateZone && (
                        <span className="ml-auto font-normal text-gray-400">
                          Zone 2-3 for you: {moderateZone.minBpm}-{moderateZone.maxBpm} bpm
                        </span>
                      )}
                    </p>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart
                        data={ouraSummary.heartRateReadings.map((hr) => ({
                          t: new Date(hr.timestamp).getTime(),
                          bpm: hr.bpm,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        {moderateZone && (
                          <ReferenceArea
                            y1={moderateZone.minBpm}
                            y2={moderateZone.maxBpm}
                            fill="#10b981"
                            fillOpacity={0.08}
                            ifOverflow="hidden"
                          />
                        )}
                        <XAxis
                          dataKey="t"
                          type="number"
                          scale="time"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(t) =>
                            new Date(t).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })
                          }
                          tick={{ fontSize: 10 }}
                          stroke="#9ca3af"
                          interval="preserveStartEnd"
                          minTickGap={40}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="#9ca3af"
                          width={32}
                          domain={["dataMin - 5", "dataMax + 5"]}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(value) => {
                            const zone = classifyHeartRate(Number(value), profile?.age)
                            return [
                              `${value} bpm${zone ? ` · Zone ${zone.zone} (${zone.name})` : ""}`,
                              "Heart Rate",
                            ]
                          }}
                          labelFormatter={(t) =>
                            new Date(t).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="bpm"
                          stroke="#ef4444"
                          strokeWidth={1.5}
                          dot={false}
                          activeDot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Moon className="h-6 w-6 text-gray-300" />
                <p className="text-sm text-gray-500">
                  Your Oura Ring is connected but there&apos;s no data for today yet.
                </p>
                <p className="text-xs text-gray-400">
                  Sleep, activity, and readiness scores will appear here once your ring syncs.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </ErrorBoundary>

      {/* VO2 Max trend: Cooper-test results + Oura estimates over time */}
      <ErrorBoundary>
        <Vo2MaxTrendCard age={profile?.age} sex={profile?.sex} />
      </ErrorBoundary>

      {/* REM sleep trend + correlations with activity/stress/sleep/readiness */}
      <ErrorBoundary>
        <RemInsightsCard />
      </ErrorBoundary>

      {/* HRV baseline vs recent — early overreaching signal */}
      <ErrorBoundary>
        <RecoveryWatchCard />
      </ErrorBoundary>

      {/* Oura Insights */}
      {ouraInsights.length > 0 && (
        <ErrorBoundary>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-amber-500" />
                Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ouraInsights.map((insight, i) => (
                  <OuraInsightRow key={i} insight={insight} />
                ))}
              </div>
            </CardContent>
          </Card>
        </ErrorBoundary>
      )}

      {/* Weight Trend */}
      <ErrorBoundary>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-5 w-5 text-blue-500" />
              Weight Trend
            </CardTitle>
            {!weightLoading && latestWeight && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-gray-900">
                  {latestWeight.weight}
                </span>
                <span className="text-xs text-gray-500">lbs</span>
                {profile?.target_weight && (
                  <span className="text-xs text-gray-400">
                    / {profile.target_weight}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {weightLoading || profileLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : weightChartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  domain={weightDomain}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                {profile?.target_weight && (
                  <ReferenceLine
                    y={profile.target_weight}
                    stroke="#22c55e"
                    strokeDasharray="6 3"
                    label={{
                      value: "Goal",
                      position: "right",
                      fontSize: 11,
                      fill: "#22c55e",
                    }}
                  />
                )}
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
            <div className="flex justify-around text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {latestWeight?.weight ?? profile?.current_weight ?? "--"}
                </p>
                <p className="text-xs text-gray-500">Current (lbs)</p>
              </div>
              <div className="h-12 w-px bg-gray-200" />
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {profile?.target_weight ?? "--"}
                </p>
                <p className="text-xs text-gray-500">Target (lbs)</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </ErrorBoundary>

      {/* Recent Workouts */}
      <ErrorBoundary>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Dumbbell className="h-5 w-5 text-purple-500" />
              Recent Workouts
            </CardTitle>
            <Link
              href="/workouts"
              className="flex items-center text-sm text-purple-600 hover:text-purple-700"
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentWorkouts && recentWorkouts.length > 0 ? (
            <div className="space-y-3">
              {recentWorkouts.map((workout) => (
                <Link
                  key={workout.id}
                  href={`/activity/${workout.id}`}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{workout.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(workout.started_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {workout.duration_mins && (
                        <> &middot; {workout.duration_mins} min</>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-gray-500">
              No workouts yet. Start your first workout!
            </div>
          )}
        </CardContent>
      </Card>
      </ErrorBoundary>

      {/* Volume Trend */}
      <ErrorBoundary>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            Volume Trend
          </CardTitle>
          <p className="text-xs text-gray-500">
            Total weight lifted per week (last 8)
          </p>
        </CardHeader>
        <CardContent>
          {deloadSuggestion && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-medium">Consider a deload week</p>
              <p className="text-amber-700">
                Volume has climbed ~{deloadSuggestion.climbPercent}% over the
                last {deloadSuggestion.weeks} weeks
                {deloadSuggestion.lowReadiness &&
                  " while your Oura readiness is running low"}
                . A lighter week now helps recovery and sets up the next push.
              </p>
            </div>
          )}
          {strengthSetsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : volumeTrend.some((v) => v.volume > 0) ? (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      [
                        typeof value === "number"
                          ? `${value.toLocaleString()} lbs`
                          : `${value}`,
                        "Volume",
                      ] as [string, string]
                    }
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    stroke="#9333ea"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#9333ea" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-gray-500">
              Log a few strength workouts to see your volume trend.
            </div>
          )}
        </CardContent>
      </Card>
      </ErrorBoundary>

      {/* Recent PRs */}
      <ErrorBoundary>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Recent PRs
          </CardTitle>
          <p className="text-xs text-gray-500">
            New weight and rep records from the last 30 days
          </p>
        </CardHeader>
        <CardContent>
          {strengthSetsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentPRs.length > 0 ? (
            <div className="space-y-2">
              {recentPRs.map((pr) => {
                const e1rm = estimateOneRepMax(pr.weight, pr.reps)
                const date = new Date(pr.startedAt).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" }
                )
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
                            <> · prev {pr.previousMaxWeight} lbs</>
                          )}
                        {pr.kind === "rep" &&
                          pr.previousMaxReps != null && (
                            <> · prev {pr.previousMaxReps} reps</>
                          )}
                        {e1rm != null && (
                          <> · est. 1RM {Math.round(e1rm)} lbs</>
                        )}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {pr.weight} lbs × {pr.reps}
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
      </ErrorBoundary>
    </div>
  )
}
