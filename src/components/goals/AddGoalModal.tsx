"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { exercises as staticExercises } from "@/data/exercises"
import {
  buildGoalInsert,
  initialGoalFormState,
  unitForGoalType,
  type AddGoalFormState,
  type EnduranceMetric,
  type GoalType,
} from "@/lib/goal-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { getAuthUserId } from "@/lib/supabase/user-query"

const supabase = createClient()

/**
 * Create a goal of any of the four types. The type/unit/insert rules live in
 * lib/goal-form; this component owns only the field state and the insert
 * mutation.
 */
export function AddGoalModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<AddGoalFormState>(initialGoalFormState)

  const strengthExercises = staticExercises.filter(
    (e) => e.exerciseType === "strength"
  )
  const cardioExercises = staticExercises.filter(
    (e) => e.exerciseType === "cardio"
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const userId = await getAuthUserId()
      const { error } = await supabase
        .from("user_goals")
        .insert(buildGoalInsert(form, userId))
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-goals"] })
      setForm(initialGoalFormState)
      onOpenChange(false)
    },
  })

  const exerciseList =
    form.goalType === "strength"
      ? strengthExercises
      : form.goalType === "endurance"
        ? cardioExercises
        : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Goal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Goal type */}
          <div className="space-y-2">
            <Label htmlFor="goal-type">Goal Type</Label>
            <Select
              id="goal-type"
              value={form.goalType}
              onChange={(e) =>
                setForm({
                  ...form,
                  goalType: e.target.value as GoalType,
                  exerciseId: "",
                })
              }
            >
              <option value="weight">Weight</option>
              <option value="strength">Strength</option>
              <option value="endurance">Endurance</option>
              <option value="consistency">Consistency</option>
            </Select>
          </div>

          {/* Endurance: longer, or further? Decides the unit, and therefore
              which logged best the goal tracks. */}
          {form.goalType === "endurance" && (
            <div className="space-y-2">
              <Label htmlFor="endurance-metric">Track</Label>
              <Select
                id="endurance-metric"
                value={form.enduranceMetric}
                onChange={(e) =>
                  setForm({
                    ...form,
                    enduranceMetric: e.target.value as EnduranceMetric,
                  })
                }
              >
                <option value="duration">Duration — longest session</option>
                <option value="distance">Distance — furthest session</option>
              </Select>
            </div>
          )}

          {/* Exercise picker for strength / endurance */}
          {(form.goalType === "strength" || form.goalType === "endurance") && (
            <div className="space-y-2">
              <Label htmlFor="exercise">Exercise</Label>
              <Select
                id="exercise"
                value={form.exerciseId}
                onChange={(e) =>
                  setForm({ ...form, exerciseId: e.target.value })
                }
              >
                <option value="">Select exercise...</option>
                {exerciseList.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Target value */}
          <div className="space-y-2">
            <Label htmlFor="target-value">
              {form.goalType === "strength" ? "Target 1-rep max" : "Target"}{" "}
              <span className="text-gray-400">
                ({unitForGoalType(form.goalType, form.enduranceMetric)})
              </span>
            </Label>
            <Input
              id="target-value"
              type="number"
              min="0"
              step="any"
              placeholder={
                form.goalType === "weight"
                  ? "e.g. 180"
                  : form.goalType === "strength"
                    ? "e.g. 225"
                    : form.goalType === "endurance"
                      ? "e.g. 30"
                      : "e.g. 4"
              }
              value={form.targetValue}
              onChange={(e) =>
                setForm({ ...form, targetValue: e.target.value })
              }
            />
            {form.goalType === "strength" && (
              <p className="text-xs text-gray-500">
                Tracked as your estimated 1-rep max (Epley) — heavier weight
                and more reps both move it, so sub-max sets count too.
              </p>
            )}
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="deadline">
              Deadline{" "}
              <span className="text-gray-400">(optional)</span>
            </Label>
            <Input
              id="deadline"
              type="date"
              value={form.deadline}
              onChange={(e) =>
                setForm({ ...form, deadline: e.target.value })
              }
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">
              {(mutation.error as Error).message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.targetValue}
          >
            {mutation.isPending ? "Saving..." : "Save Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
