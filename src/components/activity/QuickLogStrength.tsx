"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { exercises as exerciseCatalog, type ExerciseDefinition } from "@/data/exercises"
import { ensureExercisesExist } from "@/lib/supabase/exercises"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ExercisePicker } from "@/components/activity/exercise-picker"
import { Dumbbell, Plus, Trash2 } from "lucide-react"

const supabase = createClient()

interface QuickSet {
  weight: string
  reps: string
}

function makeEmptySet(): QuickSet {
  return { weight: "", reps: "" }
}

export function QuickLogStrength() {
  const [open, setOpen] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [selected, setSelected] = useState<ExerciseDefinition | null>(null)
  const [sets, setSets] = useState<QuickSet[]>([makeEmptySet()])
  const [durationMins, setDurationMins] = useState("")
  const queryClient = useQueryClient()

  function reset() {
    setSelected(null)
    setSets([makeEmptySet()])
    setDurationMins("")
  }

  function handlePicked(def: ExerciseDefinition) {
    setSelected(def)
    setSets(Array.from({ length: def.defaultSets || 3 }, () => makeEmptySet()))
    setShowPicker(false)
  }

  function updateSet(idx: number, patch: Partial<QuickSet>) {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  function addSet() {
    setSets((prev) => [...prev, makeEmptySet()])
  }

  function removeSet(idx: number) {
    setSets((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  const validSets = sets
    .map((s) => ({ weight: Number(s.weight), reps: parseInt(s.reps, 10) }))
    .filter((s) => s.reps > 0)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Pick an exercise")
      if (validSets.length === 0) throw new Error("Enter at least one set")

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const idMap = await ensureExercisesExist(supabase, [selected.id])
      const dbExerciseId = idMap.get(selected.id)
      if (!dbExerciseId) throw new Error("Exercise not found in database")

      // Approximate when the session happened: now minus duration (or ~5 min
      // if user didn't enter duration).
      const mins = parseInt(durationMins, 10) || 5
      const now = new Date()
      const startedAt = new Date(now.getTime() - mins * 60_000)

      const { data: workoutLog, error: wErr } = await supabase
        .from("workout_logs")
        .insert({
          user_id: user.id,
          name: selected.name,
          started_at: startedAt.toISOString(),
          finished_at: now.toISOString(),
          duration_mins: mins,
        })
        .select("id")
        .single()
      if (wErr) throw wErr

      const { data: exerciseLog, error: eErr } = await supabase
        .from("exercise_logs")
        .insert({
          workout_log_id: workoutLog.id,
          exercise_id: dbExerciseId,
          order_index: 0,
        })
        .select("id")
        .single()
      if (eErr) throw eErr

      const setRows = validSets.map((s, i) => ({
        exercise_log_id: exerciseLog.id,
        set_number: i + 1,
        reps: s.reps,
        weight: Number.isFinite(s.weight) && s.weight > 0 ? s.weight : null,
      }))
      const { error: sErr } = await supabase.from("set_logs").insert(setRows)
      if (sErr) throw sErr

      return workoutLog.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-workouts"] })
      queryClient.invalidateQueries({ queryKey: ["weekly-calories"] })
      queryClient.invalidateQueries({ queryKey: ["recent-workouts"] })
      setOpen(false)
      reset()
    },
  })

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) reset()
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
        >
          <Dumbbell className="h-4 w-4" />
          Quick Strength
        </button>
        <DialogContent className="mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Log Strength</DialogTitle>
            <DialogDescription>
              Log a set-by-set lift you just finished.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
            className="mt-4 space-y-4"
          >
            {/* Exercise picker */}
            {selected ? (
              <div className="flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2">
                <span className="text-sm font-medium text-purple-900">
                  {selected.name}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="text-xs font-medium text-purple-700 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowPicker(true)}
                className="w-full"
              >
                Choose Exercise
              </Button>
            )}

            {/* Sets */}
            {selected && (
              <div className="space-y-2">
                <div className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2 text-xs font-medium uppercase text-gray-400">
                  <span className="text-center">Set</span>
                  <span>Weight</span>
                  <span>Reps</span>
                  <span />
                </div>
                {sets.map((s, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2"
                  >
                    <span className="text-center text-sm font-semibold text-gray-500">
                      {i + 1}
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="lbs"
                      value={s.weight}
                      onChange={(e) =>
                        updateSet(i, { weight: e.target.value })
                      }
                      className="h-10 text-center text-base"
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="reps"
                      value={s.reps}
                      onChange={(e) => updateSet(i, { reps: e.target.value })}
                      className="h-10 text-center text-base"
                    />
                    <button
                      type="button"
                      onClick={() => removeSet(i)}
                      disabled={sets.length <= 1}
                      className="text-gray-400 hover:text-red-500 disabled:opacity-30"
                      aria-label="Remove set"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addSet}
                  className="gap-1 text-purple-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Set
                </Button>
              </div>
            )}

            {/* Optional duration */}
            {selected && (
              <div className="space-y-1">
                <label
                  htmlFor="qls-duration"
                  className="text-xs font-medium text-gray-500"
                >
                  Duration (min, optional)
                </label>
                <Input
                  id="qls-duration"
                  type="number"
                  min={1}
                  max={180}
                  placeholder="e.g. 10"
                  value={durationMins}
                  onChange={(e) => setDurationMins(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            {mutation.isError && (
              <p className="text-sm text-red-600">
                {(mutation.error as Error).message}
              </p>
            )}

            <DialogFooter>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  mutation.isPending || !selected || validSets.length === 0
                }
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {mutation.isPending ? "Saving…" : "Log It"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Full-screen picker, rendered as a sibling so it sits above the
          dialog backdrop. */}
      {showPicker && (
        <ExercisePicker
          onSelect={handlePicked}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
