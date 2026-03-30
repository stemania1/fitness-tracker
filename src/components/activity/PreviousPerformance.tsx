"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { exercises as exerciseCatalog } from "@/data/exercises"

interface SetData {
  set_number: number
  reps: number | null
  weight: number | null
  duration_mins: number | null
  distance_miles: number | null
}

interface PreviousPerformanceProps {
  exerciseId: string
  exerciseType: "strength" | "cardio" | "flexibility"
}

async function fetchPreviousPerformance(
  exerciseId: string
): Promise<SetData[] | null> {
  const supabase = createClient()

  // Get the exercise name from static data using the slug
  const staticExercise = exerciseCatalog.find((e) => e.id === exerciseId)
  if (!staticExercise) return null

  // Look up the database UUID by exercise name
  const { data: dbExercise } = await supabase
    .from("exercises")
    .select("id")
    .eq("name", staticExercise.name)
    .single()

  if (!dbExercise) return null

  // Find the most recent exercise_log for this exercise (via workout_logs for ordering)
  const { data: exerciseLog } = await supabase
    .from("exercise_logs")
    .select(
      `
      id,
      workout_log:workout_logs!inner(started_at)
    `
    )
    .eq("exercise_id", dbExercise.id)
    .order("workout_log(started_at)", { ascending: false })
    .limit(1)
    .single()

  if (!exerciseLog) return null

  // Get the set_logs for that exercise_log
  const { data: sets } = await supabase
    .from("set_logs")
    .select("set_number, reps, weight, duration_mins, distance_miles")
    .eq("exercise_log_id", exerciseLog.id)
    .order("set_number", { ascending: true })

  return sets ?? null
}

function formatStrengthSets(sets: SetData[]): string {
  return sets
    .map((s) => {
      const weight = s.weight != null ? `${s.weight} lbs` : "BW"
      const reps = s.reps != null ? `${s.reps}` : "?"
      return `${weight} \u00d7 ${reps}`
    })
    .join(", ")
}

function formatCardioSets(sets: SetData[]): string {
  const parts: string[] = []
  const totalMins = sets.reduce((sum, s) => sum + (s.duration_mins ?? 0), 0)
  const totalDist = sets.reduce(
    (sum, s) => sum + (s.distance_miles ?? 0),
    0
  )
  if (totalMins > 0) parts.push(`${totalMins} min`)
  if (totalDist > 0) parts.push(`${totalDist} mi`)
  return parts.join(", ")
}

export function PreviousPerformance({
  exerciseId,
  exerciseType,
}: PreviousPerformanceProps) {
  const { data: sets, isLoading } = useQuery({
    queryKey: ["previousPerformance", exerciseId],
    queryFn: () => fetchPreviousPerformance(exerciseId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  if (isLoading) {
    return (
      <p className="mt-1 text-xs text-gray-400">Loading previous...</p>
    )
  }

  if (!sets || sets.length === 0) {
    return null
  }

  const formatted =
    exerciseType === "cardio"
      ? formatCardioSets(sets)
      : formatStrengthSets(sets)

  return (
    <p className="mt-1 text-xs text-gray-400">
      Last: {formatted}
    </p>
  )
}
