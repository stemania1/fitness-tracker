"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { generateWorkout, type GeneratedWorkout } from "@/lib/workout-generator"
import { ensureExercisesExist } from "@/lib/supabase/exercises"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sparkles,
  Dumbbell,
  Clock,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react"
import { GOALS, FITNESS_LEVELS, SPLIT_TYPES } from "@/lib/constants"

const supabase = createClient()

function goalLabel(value: string) {
  return GOALS.find((g) => g.value === value)?.label ?? value
}

function fitnessLevelLabel(value: string) {
  return FITNESS_LEVELS.find((l) => l.value === value)?.label ?? value
}

function splitLabel(value: string) {
  return SPLIT_TYPES.find((s) => s.value === value)?.label ?? value
}

export default function GenerateWorkoutPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [generatedWorkouts, setGeneratedWorkouts] = useState<
    GeneratedWorkout[] | null
  >(null)

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
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

  function handleGenerate() {
    if (!profile) return
    const workouts = generateWorkout({
      goal: profile.primary_goal ?? "general_fitness",
      fitnessLevel: profile.fitness_level ?? "beginner",
      workoutDays: profile.workout_days ?? 3,
      limitations: profile.limitations ?? undefined,
    })
    setGeneratedWorkouts(workouts)
  }

  const saveMutation = useMutation({
    mutationFn: async (workouts: GeneratedWorkout[]) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Collect all unique exercise IDs from generated workouts
      const allExerciseIds = [
        ...new Set(
          workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId))
        ),
      ]

      // Ensure all exercises exist in the DB and get ID mapping
      const idMap = await ensureExercisesExist(supabase, allExerciseIds)

      // Save each workout template and its exercises
      for (const workout of workouts) {
        const { data: template, error: templateError } = await supabase
          .from("workout_templates")
          .insert({
            user_id: user.id,
            name: workout.name,
            split_type: workout.splitType as any,
            estimated_mins: workout.estimatedMins,
            is_generated: true,
          })
          .select("id")
          .single()

        if (templateError) throw templateError

        const templateExercises = workout.exercises
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
              notes: null,
            }
          })
          .filter(Boolean)

        if (templateExercises.length > 0) {
          const { error: exError } = await supabase
            .from("template_exercises")
            .insert(templateExercises as any[])

          if (exError) throw exError
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] })
      router.push("/workouts")
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Generate Workout Plan
        </h1>
      </div>

      {/* Profile Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {profileLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
            </div>
          ) : profile ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Goal</span>
                <span className="font-medium text-gray-900">
                  {goalLabel(profile.primary_goal ?? "general_fitness")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fitness Level</span>
                <span className="font-medium text-gray-900">
                  {fitnessLevelLabel(
                    profile.fitness_level ?? "beginner"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Workout Days/Week</span>
                <span className="font-medium text-gray-900">
                  {profile.workout_days ?? 3}
                </span>
              </div>
              {profile.limitations && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Limitations</span>
                  <span className="font-medium text-gray-900">
                    {profile.limitations}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Could not load profile.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Generate Button */}
      {!generatedWorkouts && (
        <Button
          size="lg"
          className="w-full gap-2"
          onClick={handleGenerate}
          disabled={profileLoading || !profile}
        >
          <Sparkles className="h-5 w-5" />
          Generate Workouts
        </Button>
      )}

      {/* Generated Workout Preview */}
      {generatedWorkouts && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Generated Plan ({generatedWorkouts.length} workouts)
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
            >
              Regenerate
            </Button>
          </div>

          <div className="space-y-4">
            {generatedWorkouts.map((workout, wIdx) => (
              <Card key={wIdx}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {workout.name}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge>{splitLabel(workout.splitType)}</Badge>
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3 w-3" />
                        {workout.estimatedMins} min
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {workout.exercises.map((ex, eIdx) => (
                      <div
                        key={eIdx}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {ex.name}
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {ex.muscleGroups.map((mg) => (
                              <Badge
                                key={mg}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {mg}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="ml-3 flex-shrink-0 text-right">
                          <p className="text-sm font-medium text-gray-700">
                            {ex.sets} x {ex.reps}
                          </p>
                          {ex.restSeconds > 0 && (
                            <p className="text-xs text-gray-500">
                              {ex.restSeconds}s rest
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Save All Button */}
          <div className="sticky bottom-20 z-10">
            <Button
              size="lg"
              className="w-full gap-2 shadow-lg"
              onClick={() => saveMutation.mutate(generatedWorkouts)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              {saveMutation.isPending
                ? "Saving..."
                : "Save All Workouts"}
            </Button>
            {saveMutation.isError && (
              <p className="mt-2 text-center text-sm text-red-600">
                Failed to save workouts. Please try again.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
