"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { ensureExercisesExist } from "@/lib/supabase/exercises"
import { TRAINING_PLAN_PRESETS } from "@/data/template-presets"
import { Check, Plus } from "lucide-react"

const supabase = createClient()

const PRESET_NAMES = TRAINING_PLAN_PRESETS.map((p) => p.name)

/**
 * One-tap creation of the plan's Pull A / Pull B workout templates.
 * Presets that already exist (by name) are skipped, so the button is
 * safe to press twice.
 */
export function AddPlanTemplates() {
  const queryClient = useQueryClient()

  const { data: existingNames, isLoading } = useQuery({
    queryKey: ["plan-preset-templates"],
    queryFn: async (): Promise<string[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("workout_templates")
        .select("name")
        .eq("user_id", user.id)
        .in("name", PRESET_NAMES)
      if (error) throw error
      return (data ?? []).map((t) => t.name)
    },
  })

  const missing = TRAINING_PLAN_PRESETS.filter(
    (p) => !(existingNames ?? []).includes(p.name)
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const allExerciseIds = [
        ...new Set(
          missing.flatMap((p) => p.exercises.map((e) => e.exerciseId))
        ),
      ]
      const idMap = await ensureExercisesExist(supabase, allExerciseIds)

      for (const preset of missing) {
        const { data: template, error: templateError } = await supabase
          .from("workout_templates")
          .insert({
            user_id: user.id,
            name: preset.name,
            description: preset.description,
            split_type: preset.splitType,
            estimated_mins: preset.estimatedMins,
            is_generated: false,
          })
          .select("id")
          .single()
        if (templateError) throw templateError

        const rows = preset.exercises
          .map((ex, index) => {
            const dbExerciseId = idMap.get(ex.exerciseId)
            if (!dbExerciseId) return null
            return {
              template_id: template.id,
              exercise_id: dbExerciseId,
              order_index: index,
              sets: ex.sets,
              reps: ex.reps,
              rest_seconds: ex.restSeconds,
              notes: ex.notes,
            }
          })
          .filter(Boolean)

        if (rows.length > 0) {
          const { error: exError } = await supabase
            .from("template_exercises")
            .insert(rows as NonNullable<(typeof rows)[number]>[])
          if (exError) throw exError
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] })
      queryClient.invalidateQueries({ queryKey: ["plan-preset-templates"] })
    },
  })

  if (isLoading) return null

  if (missing.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
        <Check className="h-4 w-4" />
        Pull A &amp; Pull B templates added
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {mutation.isPending
          ? "Adding…"
          : `Add ${missing.map((p) => p.name).join(" + ")} template${missing.length > 1 ? "s" : ""}`}
      </button>
      {mutation.isError && (
        <p className="text-sm text-red-600">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  )
}
