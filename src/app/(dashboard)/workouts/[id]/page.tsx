"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Clock,
  Dumbbell,
  Play,
  Pencil,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Save,
  Loader2,
} from "lucide-react"
import { SPLIT_TYPES } from "@/lib/constants"
import { ExercisePicker } from "@/components/activity/exercise-picker"
import { ensureExercisesExist } from "@/lib/supabase/exercises"
import type { ExerciseDefinition } from "@/data/exercises"

const supabase = createClient()

function splitLabel(value: string) {
  return SPLIT_TYPES.find((s) => s.value === value)?.label ?? value
}

interface TemplateExerciseRow {
  id: string
  exercise_id: string
  order_index: number
  sets: number
  reps: string
  rest_seconds: number
  notes: string | null
  exercises: {
    id: string
    name: string
    muscle_groups: string[]
    exercise_type: string
  }
}

interface EditableExercise {
  id: string
  exerciseId: string
  name: string
  muscleGroups: string[]
  sets: number
  reps: string
  restSeconds: number
  orderIndex: number
  // staticSlug is set for newly added (unsaved) exercises so we can resolve
  // the static catalog ID to a database UUID on save. Existing rows have id
  // set and don't need this.
  staticSlug?: string
}

export default function WorkoutDetailPage() {
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const templateId = params.id as string

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editExercises, setEditExercises] = useState<EditableExercise[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const { data: template, isLoading } = useQuery<any>({
    queryKey: ["workout-template", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_templates")
        .select(
          `
          id, name, split_type, estimated_mins, is_generated, description,
          template_exercises(
            id, exercise_id, order_index, sets, reps, rest_seconds, notes,
            exercises(id, name, muscle_groups, exercise_type)
          )
        `
        )
        .eq("id", templateId)
        .single()

      if (error) throw error
      return data as any
    },
  })

  const exercises = (
    ((template as any)?.template_exercises as TemplateExerciseRow[]) ?? []
  ).sort((a, b) => a.order_index - b.order_index)

  function startEditing() {
    if (!template) return
    setEditName(template.name)
    setEditExercises(
      exercises.map((te) => ({
        id: te.id,
        exerciseId: te.exercise_id,
        name: te.exercises?.name ?? "Unknown",
        muscleGroups: te.exercises?.muscle_groups ?? [],
        sets: te.sets,
        reps: te.reps,
        restSeconds: te.rest_seconds,
        orderIndex: te.order_index,
      }))
    )
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setEditExercises([])
    setEditName("")
  }

  function moveExercise(index: number, direction: "up" | "down") {
    const next = [...editExercises]
    const swapIdx = direction === "up" ? index - 1 : index + 1
    if (swapIdx < 0 || swapIdx >= next.length) return
    ;[next[index], next[swapIdx]] = [next[swapIdx], next[index]]
    next.forEach((ex, i) => (ex.orderIndex = i))
    setEditExercises(next)
  }

  function removeExercise(index: number) {
    const next = editExercises.filter((_, i) => i !== index)
    next.forEach((ex, i) => (ex.orderIndex = i))
    setEditExercises(next)
  }

  function addExerciseFromPicker(def: ExerciseDefinition) {
    setEditExercises((prev) => [
      ...prev,
      {
        id: "",
        exerciseId: "",
        staticSlug: def.id,
        name: def.name,
        muscleGroups: def.muscleGroups,
        sets: def.defaultSets,
        reps: def.defaultReps,
        restSeconds: def.exerciseType === "cardio" ? 0 : 60,
        orderIndex: prev.length,
      },
    ])
    setShowPicker(false)
  }

  function updateExerciseField(
    index: number,
    field: "sets" | "reps" | "restSeconds",
    value: string
  ) {
    const next = [...editExercises]
    if (field === "sets" || field === "restSeconds") {
      const num = parseInt(value, 10)
      if (!isNaN(num)) {
        next[index] = { ...next[index], [field]: num }
      }
    } else {
      next[index] = { ...next[index], [field]: value }
    }
    setEditExercises(next)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Update template name
      const { error: nameError } = await supabase
        .from("workout_templates")
        .update({ name: editName, updated_at: new Date().toISOString() })
        .eq("id", templateId)

      if (nameError) throw nameError

      // Delete removed exercises
      const keepIds = editExercises.map((e) => e.id).filter(Boolean)
      const currentIds = exercises.map((e) => e.id)
      const toDelete = currentIds.filter((id) => !keepIds.includes(id))

      if (toDelete.length > 0) {
        const { error: delError } = await supabase
          .from("template_exercises")
          .delete()
          .in("id", toDelete)

        if (delError) throw delError
      }

      // Update remaining exercises
      for (const ex of editExercises) {
        if (!ex.id) continue
        const { error: upError } = await supabase
          .from("template_exercises")
          .update({
            order_index: ex.orderIndex,
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.restSeconds,
          })
          .eq("id", ex.id)

        if (upError) throw upError
      }

      // Insert newly added exercises (those without a db row id yet)
      const newExercises = editExercises.filter(
        (e) => !e.id && e.staticSlug
      )
      if (newExercises.length > 0) {
        const slugs = newExercises.map((e) => e.staticSlug!)
        const idMap = await ensureExercisesExist(supabase, slugs)
        const rows = newExercises
          .map((ex) => {
            const dbExerciseId = idMap.get(ex.staticSlug!)
            if (!dbExerciseId) return null
            return {
              template_id: templateId,
              exercise_id: dbExerciseId,
              order_index: ex.orderIndex,
              sets: ex.sets,
              reps: ex.reps,
              rest_seconds: ex.restSeconds,
              notes: null,
            }
          })
          .filter(Boolean)

        if (rows.length > 0) {
          const { error: insertError } = await supabase
            .from("template_exercises")
            .insert(rows as any[])
          if (insertError) throw insertError
        }
      }

      // Recalculate estimated duration
      const strengthSets = editExercises
        .filter((e) => e.restSeconds > 0)
        .reduce((sum, e) => sum + e.sets, 0)
      const hasCardio = editExercises.some((e) => e.restSeconds === 0)
      const estimatedMins = Math.round(strengthSets * 2.5 + (hasCardio ? 20 : 0))

      await supabase
        .from("workout_templates")
        .update({ estimated_mins: estimatedMins })
        .eq("id", templateId)
    },
    onSuccess: () => {
      setIsEditing(false)
      queryClient.invalidateQueries({
        queryKey: ["workout-template", templateId],
      })
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: async ({
      exerciseA,
      exerciseB,
    }: {
      exerciseA: { id: string; order_index: number }
      exerciseB: { id: string; order_index: number }
    }) => {
      // Swap the order_index values of the two adjacent exercises
      const { error: errorA } = await supabase
        .from("template_exercises")
        .update({ order_index: exerciseB.order_index })
        .eq("id", exerciseA.id)

      if (errorA) throw errorA

      const { error: errorB } = await supabase
        .from("template_exercises")
        .update({ order_index: exerciseA.order_index })
        .eq("id", exerciseB.id)

      if (errorB) throw errorB
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workout-template", templateId],
      })
    },
  })

  function handleReorder(index: number, direction: "up" | "down") {
    const swapIdx = direction === "up" ? index - 1 : index + 1
    if (swapIdx < 0 || swapIdx >= exercises.length) return

    reorderMutation.mutate({
      exerciseA: {
        id: exercises[index].id,
        order_index: exercises[index].order_index,
      },
      exerciseB: {
        id: exercises[swapIdx].id,
        order_index: exercises[swapIdx].order_index,
      },
    })
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Delete template exercises first (cascade may handle this, but be explicit)
      const { error: exError } = await supabase
        .from("template_exercises")
        .delete()
        .eq("template_id", templateId)

      if (exError) throw exError

      const { error } = await supabase
        .from("workout_templates")
        .delete()
        .eq("id", templateId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] })
      router.push("/workouts")
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-center text-gray-500">Workout not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-xl font-bold"
            />
          ) : (
            <h1 className="truncate text-2xl font-bold text-gray-900">
              {template.name}
            </h1>
          )}
        </div>
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2">
        <Badge>{splitLabel(template.split_type)}</Badge>
        {template.estimated_mins && (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            {template.estimated_mins} min
          </Badge>
        )}
        <Badge variant="secondary">
          <Dumbbell className="mr-1 h-3 w-3" />
          {exercises.length} exercises
        </Badge>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <a href={`/activity/log?template=${template.id}`} className="flex-1">
          <Button className="w-full gap-2">
            <Play className="h-4 w-4" />
            Start Workout
          </Button>
        </a>
        {isEditing ? (
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={cancelEditing}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="icon"
            onClick={startEditing}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {saveMutation.isError && (
        <p className="text-sm text-red-600">
          Failed to save changes. Please try again.
        </p>
      )}

      {reorderMutation.isError && (
        <p className="text-sm text-red-600">
          Failed to reorder exercises. Please try again.
        </p>
      )}

      {/* Exercise List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Exercises
        </h2>
        {isEditing && (
          <Button
            variant="secondary"
            onClick={() => setShowPicker(true)}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Exercise
          </Button>
        )}
        {isEditing
          ? editExercises.map((ex, idx) => (
              <Card key={ex.id || idx}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-1 pt-1">
                      <button
                        onClick={() => moveExercise(idx, "up")}
                        disabled={idx === 0}
                        className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveExercise(idx, "down")}
                        disabled={idx === editExercises.length - 1}
                        className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium text-gray-900">
                        {ex.name}
                      </p>
                      <div className="flex flex-wrap gap-1">
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
                      <div className="flex flex-wrap gap-2">
                        <div className="w-16">
                          <label className="text-xs text-gray-500">
                            Sets
                          </label>
                          <Input
                            type="number"
                            value={ex.sets}
                            onChange={(e) =>
                              updateExerciseField(
                                idx,
                                "sets",
                                e.target.value
                              )
                            }
                            min={1}
                            max={10}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="w-16">
                          <label className="text-xs text-gray-500">
                            Reps
                          </label>
                          <Input
                            value={ex.reps}
                            onChange={(e) =>
                              updateExerciseField(
                                idx,
                                "reps",
                                e.target.value
                              )
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="w-16">
                          <label className="text-xs text-gray-500">
                            Rest (s)
                          </label>
                          <Input
                            type="number"
                            value={ex.restSeconds}
                            onChange={(e) =>
                              updateExerciseField(
                                idx,
                                "restSeconds",
                                e.target.value
                              )
                            }
                            min={0}
                            step={15}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeExercise(idx)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))
          : exercises.map((te, idx) => (
              <Card key={te.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleReorder(idx, "up")}
                      disabled={
                        idx === 0 || reorderMutation.isPending
                      }
                      className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      aria-label="Move exercise up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleReorder(idx, "down")}
                      disabled={
                        idx === exercises.length - 1 ||
                        reorderMutation.isPending
                      }
                      className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      aria-label="Move exercise down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {te.exercises?.name ?? "Unknown Exercise"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(te.exercises?.muscle_groups ?? []).map((mg) => (
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
                      {te.sets} x {te.reps}
                    </p>
                    {te.rest_seconds > 0 && (
                      <p className="text-xs text-gray-500">
                        {te.rest_seconds}s rest
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Delete section */}
      {!isEditing && (
        <div className="border-t border-gray-200 pt-6">
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete Workout
          </Button>
        </div>
      )}

      {/* Exercise picker modal */}
      {showPicker && (
        <ExercisePicker
          onSelect={addExerciseFromPicker}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workout</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{template.name}
              &rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
