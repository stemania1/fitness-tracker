"use client"

import { useMemo } from "react"
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
} from "lucide-react"
import { exercises as exerciseCatalog } from "@/data/exercises"
import { estimateStrengthCalories, estimateCardioCalories } from "@/lib/calories"
import type { OuraSummary } from "@/lib/oura"
import { formatSleepDuration } from "@/lib/oura"

const supabase = createClient()

function getStartOfWeek() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
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

  const { data: latestWeight, isLoading: weightLoading } = useQuery({
    queryKey: ["latest-weight"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("weight_logs")
        .select("weight, logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(1)
      if (error) throw error
      return data?.[0] ?? null
    },
  })

  const exerciseMap = useMemo(
    () => new Map(exerciseCatalog.map((e) => [e.id, e])),
    []
  )

  const { data: weeklyCalories, isLoading: caloriesLoading } = useQuery({
    queryKey: ["weekly-calories", weekStart],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Get user weight
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("current_weight")
        .eq("id", user.id)
        .single()
      const weightLbs = prof?.current_weight ?? 170

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
        const def = exerciseMap.get(ex.exercise_id)
        const sets = setsByEx.get(ex.id) ?? []
        if (def?.exerciseType === "cardio") {
          const totalMins = sets.reduce((s, set) => s + (set.duration_mins ?? 0), 0)
          totalCal += estimateCardioCalories(ex.exercise_id, totalMins, weightLbs)
        } else {
          totalCal += estimateStrengthCalories(ex.exercise_id, sets.length, weightLbs)
        }
      })

      return totalCal
    },
  })

  // Oura Ring daily summary
  const { data: ouraSummary, isLoading: ouraLoading } = useQuery<OuraSummary | null>({
    queryKey: ["oura-summary"],
    queryFn: async () => {
      const res = await fetch("/api/oura")
      if (!res.ok) return null
      return res.json() as Promise<OuraSummary>
    },
    retry: false,
  })

  const { data: personalRecords, isLoading: prsLoading } = useQuery({
    queryKey: ["personal-records"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("set_logs")
        .select(`
          weight,
          reps,
          exercise_log:exercise_logs!inner(
            exercise:exercises!inner(name),
            workout_log:workout_logs!inner(user_id, started_at)
          )
        `)
        .eq("exercise_log.workout_log.user_id", user.id)
        .not("weight", "is", null)
        .order("weight", { ascending: false })
        .limit(5)
      if (error) throw error
      return data as any[]
    },
  })

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
      <div className="flex gap-3">
        <Link
          href="/activity"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Start Workout
        </Link>
        <Link
          href="/activity?tab=weight"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
        >
          <Scale className="h-4 w-4" />
          Log Weight
        </Link>
      </div>

      {/* This Week */}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Oura Ring Summary */}
      {!ouraLoading && ouraSummary && (ouraSummary.sleep || ouraSummary.activity || ouraSummary.readiness) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-teal-500" />
              Today&apos;s Oura Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {/* Sleep */}
              {ouraSummary.sleep && (
                <div className="rounded-lg bg-indigo-50 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600">
                    <Moon className="h-3.5 w-3.5" />
                    Sleep
                  </div>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {ouraSummary.sleep.score ?? "--"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {ouraSummary.sleep.total_sleep_duration
                      ? formatSleepDuration(ouraSummary.sleep.total_sleep_duration)
                      : "No data"}
                  </p>
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
                    Resting HR
                  </div>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {ouraSummary.restingHeartRate}
                  </p>
                  <p className="text-xs text-gray-500">bpm</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weight Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-5 w-5 text-blue-500" />
            Weight Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weightLoading || profileLoading ? (
            <div className="flex justify-around">
              <Skeleton className="h-12 w-20" />
              <Skeleton className="h-12 w-20" />
            </div>
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

      {/* Recent Workouts */}
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
                <div
                  key={workout.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
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
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-gray-500">
              No workouts yet. Start your first workout!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal Records */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Personal Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : personalRecords && personalRecords.length > 0 ? (
            <div className="space-y-2">
              {personalRecords.map((pr, index) => {
                const exerciseLog = pr.exercise_log as any
                const exerciseName = exerciseLog?.exercise?.name ?? "Unknown"
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {exerciseName}
                    </span>
                    <Badge variant="secondary">
                      {pr.weight} lbs {pr.reps ? `x ${pr.reps}` : ""}
                    </Badge>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-gray-500">
              No personal records yet. Keep training!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
