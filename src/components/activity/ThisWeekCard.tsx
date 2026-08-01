"use client"

import { useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Flame } from "lucide-react"
import { exercises as exerciseCatalog } from "@/data/exercises"
import { estimateStrengthCalories, estimateCardioCalories } from "@/lib/calories"
import { calcWeeklyStreak, startOfWeekISO } from "@/lib/weekly-progress"
import { useProfile } from "@/hooks/useProfile"
import { useUserQuery } from "@/lib/supabase/user-query"
import { CARD_ACCENTS } from "@/lib/constants"

const supabase = createClient()

/**
 * This week's workout progress against the weekly target, plus calories burned
 * and the current multi-week streak. A daily-glance card, so it stays on the
 * dashboard — but self-fetching, like the rest.
 */
export function ThisWeekCard() {
  const weekStart = useMemo(() => startOfWeekISO(), [])

  const exerciseNameMap = useMemo(
    () => new Map(exerciseCatalog.map((e) => [e.name.toLowerCase(), e])),
    []
  )

  const { data: profile, isLoading: profileLoading } = useProfile()

  const { data: weeklyWorkouts, isLoading: weeklyLoading } = useUserQuery(
    ["weekly-workouts", weekStart],
    async (userId) => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("user_id", userId)
        .gte("started_at", weekStart)
      if (error) throw error
      return data
    }
  )

  // Shared key with the dashboard's own all-logs query, so this reads cache.
  const { data: allWorkoutLogs, isLoading: allWorkoutsLoading } = useUserQuery(
    ["workout-logs-all"],
    async (userId) => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, started_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: true })
      if (error) throw error
      return data
    }
  )

  // The RMR correction reads from the shared profile rather than its own
  // fetch. weightLbs is in the key on purpose: logging a weigh-in invalidates
  // ["profile"], and keying on the new weight is what makes this recompute
  // instead of serving calories derived from the old one.
  const weightLbs = profile?.current_weight ?? 170
  const calorieProfile = useMemo(
    () => ({
      age: profile?.age,
      sex: profile?.sex,
      heightInches: profile?.height_inches,
    }),
    [profile?.age, profile?.sex, profile?.height_inches]
  )

  const { data: weeklyCalories, isLoading: caloriesLoading } = useUserQuery(
    ["weekly-calories", weekStart, weightLbs],
    async (userId) => {
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("user_id", userId)
        .gte("started_at", weekStart)
      if (!logs || logs.length === 0) return 0

      const logIds = logs.map((l) => l.id)

      const { data: exLogs } = await supabase
        .from("exercise_logs")
        .select("id, exercise_id")
        .in("workout_log_id", logIds)
      if (!exLogs || exLogs.length === 0) return 0

      const exIds = exLogs.map((e) => e.id)
      const exerciseUuids = [...new Set(exLogs.map((e) => e.exercise_id))]

      // Bridge exercise UUIDs to the static catalog via their DB names.
      const { data: dbExercises } = await supabase
        .from("exercises")
        .select("id, name")
        .in("id", exerciseUuids)
      const uuidToName = new Map<string, string>(
        (dbExercises ?? []).map((e) => [e.id as string, e.name as string])
      )

      const { data: setLogs } = await supabase
        .from("set_logs")
        .select("exercise_log_id, reps, weight, duration_mins")
        .in("exercise_log_id", exIds)

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
          const totalMins = sets.reduce(
            (s, set) => s + (set.duration_mins ?? 0),
            0
          )
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
    { enabled: profile !== undefined }
  )

  const workoutTarget = profile?.workout_days ?? 4
  const completedWorkouts = weeklyWorkouts?.length ?? 0
  const weeklyProgress =
    workoutTarget > 0
      ? Math.round((completedWorkouts / workoutTarget) * 100)
      : 0

  const weeklyStreak = useMemo(
    () => (allWorkoutLogs ? calcWeeklyStreak(allWorkoutLogs, workoutTarget) : 0),
    [allWorkoutLogs, workoutTarget]
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className={`h-5 w-5 ${CARD_ACCENTS.progress}`} />
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
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <Flame className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-900">
                    {weeklyCalories.toLocaleString()}
                  </span>{" "}
                  calories burned
                </span>
              </div>
            )}
            {!allWorkoutsLoading && weeklyStreak >= 1 && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                <Flame className="h-4 w-4 text-emerald-600" />
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
  )
}
