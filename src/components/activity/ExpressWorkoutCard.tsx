"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { ensureExercisesExist } from "@/lib/supabase/exercises"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Zap } from "lucide-react"
import {
  generateWorkout,
  type GeneratedWorkout,
} from "@/lib/workout-generator"
import { useProfile } from "@/hooks/useProfile"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { CARD_ACCENTS } from "@/lib/constants"

const supabase = createClient()

const MINUTE_OPTIONS = [15, 20, 30]

/**
 * "I have N minutes" → a full-body, high-ROI circuit sized to fit, so a packed
 * day isn't a reason to skip. Generates on the spot and can save it into your
 * workouts to log. Respects profile goal / level / limitations.
 */
export function ExpressWorkoutCard() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [minutes, setMinutes] = useState<number | null>(null)
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null)

  const { data: profile } = useProfile()

  function pick(mins: number) {
    setMinutes(mins)
    const [w] = generateWorkout({
      goal: profile?.primary_goal ?? "general_fitness",
      fitnessLevel: profile?.fitness_level ?? "beginner",
      workoutDays: 1,
      splitType: "express",
      targetMinutes: mins,
      limitations: profile?.limitations ?? undefined,
      age: profile?.age ?? null,
    })
    setWorkout(w)
  }

  const save = useMutation({
    mutationFn: async (w: GeneratedWorkout) => {
      const userId = await getAuthUserId()
      const idMap = await ensureExercisesExist(
        supabase,
        w.exercises.map((e) => e.exerciseId)
      )
      const { data: template, error: tErr } = await supabase
        .from("workout_templates")
        .insert({
          user_id: userId,
          name: w.name,
          split_type: "express",
          estimated_mins: w.estimatedMins,
          is_generated: true,
        })
        .select("id")
        .single()
      if (tErr) throw tErr
      const rows = w.exercises
        .map((ex, index) => {
          const dbId = idMap.get(ex.exerciseId)
          if (!dbId) return null
          return {
            template_id: template.id,
            exercise_id: dbId,
            order_index: index,
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.restSeconds,
            notes: null,
          }
        })
        .filter(Boolean)
      if (rows.length > 0) {
        const { error: exErr } = await supabase
          .from("template_exercises")
          .insert(rows as unknown as never[])
        if (exErr) throw exErr
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] })
      router.push("/workouts")
    },
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className={`h-5 w-5 ${CARD_ACCENTS.brand}`} />
          Express workout
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-sm text-gray-500">
          Short on time? Pick what you&apos;ve got and get a full-body circuit
          that fits.
        </p>
        <div className="flex gap-2">
          {MINUTE_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pick(m)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                minutes === m
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>

        {workout && (
          <div className="mt-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-gray-900">
                {workout.name}
              </p>
              <span className="text-xs text-gray-500">
                ~{workout.estimatedMins} min
              </span>
            </div>
            <ul className="space-y-1">
              {workout.exercises.map((ex) => (
                <li
                  key={ex.exerciseId}
                  className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-sm"
                >
                  <span className="text-gray-800">{ex.name}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {ex.restSeconds > 0
                      ? `${ex.sets} × ${ex.reps}`
                      : ex.reps}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => pick(minutes!)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Reshuffle
              </button>
              <button
                type="button"
                onClick={() => save.mutate(workout)}
                disabled={save.isPending}
                className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save to my workouts"}
              </button>
            </div>
            {save.isError && (
              <p className="text-sm text-red-600">
                Couldn&apos;t save — try again.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
