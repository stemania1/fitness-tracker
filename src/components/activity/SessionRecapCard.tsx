"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus, Sparkles, Trophy } from "lucide-react"
import {
  buildSessionRecap,
  type RecapExerciseInput,
} from "@/lib/session-recap"

const supabase = createClient()

export interface RecapExercise {
  /** DB exercise UUID (exercise_logs.exercise_id). */
  exerciseUuid: string
  name: string
  /** Heaviest weight lifted this session, or null (cardio / bodyweight). */
  currentTopWeight: number | null
}

interface Props {
  /** started_at of this workout — only earlier sessions count as "previous". */
  workoutStartedAt: string
  exercises: RecapExercise[]
}

export function SessionRecapCard({ workoutStartedAt, exercises }: Props) {
  const uuids = [...new Set(exercises.map((e) => e.exerciseUuid))]

  const { data: recap } = useQuery({
    queryKey: ["session-recap", workoutStartedAt, uuids.join(",")],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null

      // Prior exercise_logs for these exercises from earlier sessions.
      const { data: rawPrior } = await supabase
        .from("exercise_logs")
        .select("id, exercise_id, workout_logs!inner(started_at, user_id)")
        .in("exercise_id", uuids.length > 0 ? uuids : ["__none__"])
        .lt("workout_logs.started_at", workoutStartedAt)
        .eq("workout_logs.user_id", user.id)

      const prior = (rawPrior ?? []) as Array<{
        id: string
        exercise_id: string
      }>
      const logIdToUuid = new Map(prior.map((r) => [r.id, r.exercise_id]))

      const maxByUuid = new Map<string, number>()
      if (prior.length > 0) {
        const { data: sets } = await supabase
          .from("set_logs")
          .select("exercise_log_id, weight")
          .in(
            "exercise_log_id",
            prior.map((r) => r.id)
          )
          .not("weight", "is", null)

        for (const s of sets ?? []) {
          const uuid = logIdToUuid.get(s.exercise_log_id)
          if (uuid && s.weight != null) {
            maxByUuid.set(uuid, Math.max(maxByUuid.get(uuid) ?? 0, s.weight))
          }
        }
      }

      const input: RecapExerciseInput[] = exercises.map((e) => ({
        name: e.name,
        currentTopWeight: e.currentTopWeight,
        previousTopWeight: maxByUuid.get(e.exerciseUuid) ?? null,
      }))
      return buildSessionRecap(input)
    },
  })

  if (!recap || recap.items.length === 0) return null

  return (
    <Card className="mb-6 border-purple-100 bg-purple-50/40">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Session recap
          </h2>
          {recap.comparableCount > 0 && (
            <span className="ml-auto text-xs font-medium text-purple-700">
              Beat {recap.beatCount} of {recap.comparableCount} lifts
            </span>
          )}
        </div>
        <ul className="space-y-1.5">
          {recap.items.map((it) => (
            <li
              key={it.name}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate text-gray-700">{it.name}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="tabular-nums text-gray-900">
                  {it.currentTopWeight} lb
                </span>
                {it.status === "up" && (
                  <span className="flex items-center gap-0.5 font-medium text-emerald-600">
                    <TrendingUp className="h-3.5 w-3.5" />+{it.delta}
                  </span>
                )}
                {it.status === "down" && (
                  <span className="flex items-center gap-0.5 font-medium text-gray-400">
                    <TrendingDown className="h-3.5 w-3.5" />
                    {it.delta}
                  </span>
                )}
                {it.status === "same" && (
                  <span className="flex items-center gap-0.5 text-gray-400">
                    <Minus className="h-3.5 w-3.5" />
                  </span>
                )}
                {it.status === "new" && (
                  <span className="flex items-center gap-0.5 text-purple-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    first
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
