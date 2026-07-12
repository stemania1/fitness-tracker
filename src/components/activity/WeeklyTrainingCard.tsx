"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Dumbbell, Timer, CalendarCheck } from "lucide-react"
import { exercises as exerciseCatalog } from "@/data/exercises"
import {
  summarizeWeekTraining,
  formatVolume,
  type WeekExercise,
} from "@/lib/weekly-summary"

const supabase = createClient()

/** Monday 00:00 (local) of the current week, as an ISO string. */
function startOfWeekISO(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

export function WeeklyTrainingCard() {
  const weekStart = useMemo(() => startOfWeekISO(), [])
  const nameToDef = useMemo(
    () => new Map(exerciseCatalog.map((e) => [e.name.toLowerCase(), e])),
    []
  )

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-training", weekStart],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data: logs } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("user_id", user.id)
        .gte("started_at", weekStart)

      const sessions = logs?.length ?? 0
      if (!logs || logs.length === 0) {
        return summarizeWeekTraining([], 0)
      }

      const logIds = logs.map((l) => l.id)
      const { data: exLogs } = await supabase
        .from("exercise_logs")
        .select("id, exercise_id")
        .in("workout_log_id", logIds)

      if (!exLogs || exLogs.length === 0) {
        return summarizeWeekTraining([], sessions)
      }

      const exIds = exLogs.map((e) => e.id)
      const uuids = [...new Set(exLogs.map((e) => e.exercise_id))]

      // Bridge DB UUIDs → catalog by name (as the calorie query does).
      const { data: dbExercises } = await supabase
        .from("exercises")
        .select("id, name")
        .in("id", uuids)
      const uuidToName = new Map<string, string>(
        (dbExercises ?? []).map((e) => [e.id as string, e.name as string])
      )

      const { data: setLogs } = await supabase
        .from("set_logs")
        .select("exercise_log_id, reps, weight, duration_mins")
        .in("exercise_log_id", exIds)

      const setsByEx = new Map<string, WeekExercise["sets"]>()
      setLogs?.forEach((s) => {
        const list = setsByEx.get(s.exercise_log_id) ?? []
        list.push({
          weight: s.weight,
          reps: s.reps,
          durationMins: s.duration_mins,
        })
        setsByEx.set(s.exercise_log_id, list)
      })

      const exercises: WeekExercise[] = exLogs.map((ex) => {
        const name = uuidToName.get(ex.exercise_id)
        const def = name ? nameToDef.get(name.toLowerCase()) : undefined
        return {
          exerciseType: def?.exerciseType ?? null,
          sets: setsByEx.get(ex.id) ?? [],
        }
      })

      return summarizeWeekTraining(exercises, sessions)
    },
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="h-5 w-5 text-purple-500" />
          Training This Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 py-4">
              <Dumbbell className="mx-auto mb-1 h-5 w-5 text-purple-500" />
              <p className="text-xl font-bold text-gray-900">
                {data ? formatVolume(data.strengthVolumeLbs) : "0"}
              </p>
              <p className="text-xs text-gray-500">Strength volume (lbs)</p>
            </div>
            <div className="rounded-lg bg-gray-50 py-4">
              <Timer className="mx-auto mb-1 h-5 w-5 text-purple-500" />
              <p className="text-xl font-bold text-gray-900">
                {data?.cardioMinutes ?? 0}
              </p>
              <p className="text-xs text-gray-500">Zone 2 / cardio (min)</p>
            </div>
          </div>
        )}
        {!isLoading && (data?.sessions ?? 0) === 0 && (
          <p className="mt-3 text-center text-xs text-gray-400">
            No sessions logged yet this week — Start Workout to get going.
          </p>
        )}
        {!isLoading && (data?.sessions ?? 0) > 0 && (
          <p className="mt-3 text-center text-xs text-gray-400">
            Zone 2 minutes are the engine behind your VO2 max — keep them
            climbing week over week.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
