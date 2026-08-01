"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { exercises as exerciseCatalog, type ExerciseDefinition } from "@/data/exercises"
import { ensureExercisesExist } from "@/lib/supabase/exercises"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ExercisePicker } from "@/components/activity/exercise-picker"
import {
  BackdateChips,
  nowLocalDatetimeString,
} from "@/components/activity/BackdateChips"
import { Dumbbell, Plus, Trash2 } from "lucide-react"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { QuickLogDialog } from "@/components/activity/QuickLogDialog"

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
  const [finishedAt, setFinishedAt] = useState<string>(
    nowLocalDatetimeString()
  )
  const queryClient = useQueryClient()

  function reset() {
    setSelected(null)
    setSets([makeEmptySet()])
    setDurationMins("")
    setFinishedAt(nowLocalDatetimeString())
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

      const userId = await getAuthUserId()

      const idMap = await ensureExercisesExist(supabase, [selected.id])
      const dbExerciseId = idMap.get(selected.id)
      if (!dbExerciseId) throw new Error("Exercise not found in database")

      // The user can backdate the session; we treat the picked datetime as
      // when the workout *finished*, and back-fill started_at from duration.
      const mins = parseInt(durationMins, 10) || 5
      const finished = finishedAt ? new Date(finishedAt) : new Date()
      if (Number.isNaN(finished.getTime())) {
        throw new Error("Invalid date")
      }
      const startedAt = new Date(finished.getTime() - mins * 60_000)

      const { data: workoutLog, error: wErr } = await supabase
        .from("workout_logs")
        .insert({
          user_id: userId,
          name: selected.name,
          started_at: startedAt.toISOString(),
          finished_at: finished.toISOString(),
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
      <QuickLogDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) reset()
        }}
        trigger={{ icon: Dumbbell, label: "Quick Strength" }}
        title="Quick Log Strength"
        description="Log a set-by-set lift you just finished."
        submitLabel="Log It"
        submitDisabled={!selected || validSets.length === 0}
        mutation={mutation}
        onSubmit={() => mutation.mutate()}
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

        {/* When did you do it? */}
        {selected && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              When
            </label>
            <BackdateChips
              value={finishedAt}
              onChange={setFinishedAt}
            />
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

      </QuickLogDialog>

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
