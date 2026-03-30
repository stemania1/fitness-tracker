"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { exercises as exerciseCatalog } from "@/data/exercises"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectOption } from "@/components/ui/select"
import { Timer } from "lucide-react"

const supabase = createClient()

const cardioExercises = exerciseCatalog.filter(
  (e) => e.exerciseType === "cardio"
)

export function QuickLogExercise() {
  const [open, setOpen] = useState(false)
  const [exerciseId, setExerciseId] = useState(cardioExercises[0]?.id ?? "")
  const [durationMins, setDurationMins] = useState("")
  const queryClient = useQueryClient()
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: async () => {
      const mins = parseInt(durationMins, 10)
      if (!mins || mins <= 0) throw new Error("Enter a valid duration")

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const exercise = cardioExercises.find((e) => e.id === exerciseId)
      const exerciseName = exercise?.name ?? "Cardio"

      const now = new Date()
      const startedAt = new Date(now.getTime() - mins * 60_000)

      // Create workout log
      const { data: workoutLog, error: wErr } = await supabase
        .from("workout_logs")
        .insert({
          user_id: user.id,
          name: exerciseName,
          started_at: startedAt.toISOString(),
          finished_at: now.toISOString(),
          duration_mins: mins,
        })
        .select("id")
        .single()
      if (wErr) throw wErr

      // Create exercise log
      const { data: exerciseLog, error: eErr } = await supabase
        .from("exercise_logs")
        .insert({
          workout_log_id: workoutLog.id,
          exercise_id: exerciseId,
          order_index: 0,
        })
        .select("id")
        .single()
      if (eErr) throw eErr

      // Create set log with duration
      const { error: sErr } = await supabase.from("set_logs").insert({
        exercise_log_id: exerciseLog.id,
        set_number: 1,
        duration_mins: mins,
      })
      if (sErr) throw sErr

      return workoutLog.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-workouts"] })
      queryClient.invalidateQueries({ queryKey: ["weekly-calories"] })
      queryClient.invalidateQueries({ queryKey: ["recent-workouts"] })
      setOpen(false)
      setDurationMins("")
      setExerciseId(cardioExercises[0]?.id ?? "")
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50">
        <Timer className="h-4 w-4" />
        Quick Log
      </DialogTrigger>
      <DialogContent className="mx-4 max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick Log Exercise</DialogTitle>
          <DialogDescription>
            Log a cardio session in seconds.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
          className="mt-4 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="ql-exercise">Exercise</Label>
            <Select
              id="ql-exercise"
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
            >
              {cardioExercises.map((ex) => (
                <SelectOption key={ex.id} value={ex.id}>
                  {ex.name}
                </SelectOption>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ql-duration">Duration (minutes)</Label>
            <Input
              id="ql-duration"
              type="number"
              min={1}
              max={300}
              placeholder="e.g. 30"
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
              autoFocus
            />
          </div>

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
              disabled={mutation.isPending || !durationMins}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Log It"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
