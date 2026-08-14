"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { ensureExercisesExist } from "@/lib/supabase/exercises"
import { ChevronDown, Zap } from "lucide-react"
import {
  generateWorkout,
  type GeneratedWorkout,
} from "@/lib/workout-generator"
import { useProfile } from "@/hooks/useProfile"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"
import { ExerciseInfoBody } from "@/components/activity/ExerciseInfo"

const supabase = createClient()

const MINUTE_OPTIONS = [15, 20, 30]

/** What happens after the circuit is persisted as a template. */
type SaveIntent = "save" | "start"

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
  /** Which circuit row has its "how do I do this" panel open, if any. */
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null)

  const { data: profile } = useProfile()

  function pick(mins: number) {
    setMinutes(mins)
    // A reshuffle renders a different list; leaving a row id open would expand
    // whichever exercise happened to reuse it.
    setOpenExerciseId(null)
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
    mutationFn: async ({ w }: { w: GeneratedWorkout; intent: SaveIntent }) => {
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
      return template.id as string
    },
    onSuccess: (templateId, { intent }) => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] })
      // "Start" goes straight into the logger preloaded with the circuit, so
      // finishing it writes a dated workout log — the same history, PRs and
      // weekly volume every other workout feeds.
      router.push(
        intent === "start" ? `/activity/log?template=${templateId}` : "/workouts"
      )
    },
  })

  const pendingIntent = save.isPending ? save.variables?.intent : undefined

  return (
    <InsightCard
      icon={Zap}
      accent="brand"
      title="Express workout"
    >
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
        {/* Each row opens the same "how do I do this" panel the logger shows —
            an express circuit is the most likely place to meet a machine you
            have never used, so the explanation has to be here too. */}
        <ul className="space-y-1">
          {workout.exercises.map((ex) => {
        const open = openExerciseId === ex.exerciseId
        return (
          <li key={ex.exerciseId} className="rounded-md bg-gray-50">
            <button
              type="button"
              onClick={() =>
                setOpenExerciseId(open ? null : ex.exerciseId)
              }
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
                <span className="truncate text-gray-800">{ex.name}</span>
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {ex.restSeconds > 0
                  ? `${ex.sets} × ${ex.reps}`
                  : ex.reps}
              </span>
            </button>
            {open && (
              <ExerciseInfoBody
                exerciseId={ex.exerciseId}
                muscleGroups={ex.muscleGroups}
                restSeconds={ex.restSeconds}
                className="rounded-b-md border-t border-gray-100 bg-white px-3 pb-3 pt-3"
              />
            )}
          </li>
        )
          })}
        </ul>
        {/* Starting is the primary action: an express circuit is something you
            do now, and it only lands in your history if it gets logged. */}
        <button
          type="button"
          onClick={() => save.mutate({ w: workout, intent: "start" })}
          disabled={save.isPending}
          className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {pendingIntent === "start" ? "Starting…" : "Start & log this workout"}
        </button>
        <div className="flex gap-2">
          <button
        type="button"
        onClick={() => pick(minutes!)}
        disabled={save.isPending}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
        Reshuffle
          </button>
          <button
        type="button"
        onClick={() => save.mutate({ w: workout, intent: "save" })}
        disabled={save.isPending}
        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
        {pendingIntent === "save" ? "Saving…" : "Save to my workouts"}
          </button>
        </div>
        {save.isError && (
          <p className="text-sm text-red-600">
        Couldn&apos;t save — try again.
          </p>
        )}
          </div>
        )}
    </InsightCard>
  )
}
