"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { exercises as exerciseCatalog } from "@/data/exercises"
import { ensureExercisesExist } from "@/lib/supabase/exercises"
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
import {
  BackdateChips,
  nowLocalDatetimeString,
} from "@/components/activity/BackdateChips"
import { Timer } from "lucide-react"

const supabase = createClient()

const cardioExercises = exerciseCatalog.filter(
  (e) => e.exerciseType === "cardio"
)

export function QuickLogExercise() {
  const [open, setOpen] = useState(false)
  const [exerciseId, setExerciseId] = useState(cardioExercises[0]?.id ?? "")
  const [durationMins, setDurationMins] = useState("")
  const [durationSecs, setDurationSecs] = useState("")
  const [distanceMiles, setDistanceMiles] = useState("")
  const [inclinePercent, setInclinePercent] = useState("")
  const [finishedAt, setFinishedAt] = useState<string>(
    nowLocalDatetimeString()
  )
  const queryClient = useQueryClient()

  const selectedExercise = cardioExercises.find((e) => e.id === exerciseId)
  // Mirror the workout detail page: incline applies to treadmill work, while
  // distance is meaningful for any distance-based cardio.
  const isTreadmill = selectedExercise?.equipmentId === "treadmill"
  const isDistanceCardio = isTreadmill || selectedExercise?.id === "outdoor-run"

  // Total duration in decimal minutes (e.g. 10m 45s -> 10.75), rounded to the
  // two-decimal precision the set_logs column stores.
  const totalMins = (() => {
    const mins = parseInt(durationMins || "0", 10)
    const secs = parseInt(durationSecs || "0", 10)
    if (Number.isNaN(mins) || Number.isNaN(secs)) return 0
    return Math.round((mins + secs / 60) * 100) / 100
  })()

  function resetForm() {
    setDurationMins("")
    setDurationSecs("")
    setDistanceMiles("")
    setInclinePercent("")
    setExerciseId(cardioExercises[0]?.id ?? "")
    setFinishedAt(nowLocalDatetimeString())
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!totalMins || totalMins <= 0)
        throw new Error("Enter a valid duration")

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const exerciseName = selectedExercise?.name ?? "Cardio"

      // Resolve static slug ID to database UUID
      const idMap = await ensureExercisesExist(supabase, [exerciseId])
      const dbExerciseId = idMap.get(exerciseId)
      if (!dbExerciseId) throw new Error("Exercise not found in database")

      const finished = finishedAt ? new Date(finishedAt) : new Date()
      if (Number.isNaN(finished.getTime())) {
        throw new Error("Invalid date")
      }
      const startedAt = new Date(finished.getTime() - totalMins * 60_000)

      // Create workout log. The workout-level duration is whole minutes; the
      // precise mm:ss lives on the set below.
      const { data: workoutLog, error: wErr } = await supabase
        .from("workout_logs")
        .insert({
          user_id: user.id,
          name: exerciseName,
          started_at: startedAt.toISOString(),
          finished_at: finished.toISOString(),
          duration_mins: Math.max(1, Math.round(totalMins)),
        })
        .select("id")
        .single()
      if (wErr) throw wErr

      // Create exercise log
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

      // Create set log with duration, plus distance/incline when provided so
      // the detail view can derive pace.
      const setPayload: {
        exercise_log_id: string
        set_number: number
        duration_mins: number
        distance_miles?: number
        incline_percent?: number
      } = {
        exercise_log_id: exerciseLog.id,
        set_number: 1,
        duration_mins: totalMins,
      }
      if (isDistanceCardio && distanceMiles.trim() !== "") {
        const dist = parseFloat(distanceMiles)
        if (!Number.isNaN(dist) && dist > 0) setPayload.distance_miles = dist
      }
      if (isTreadmill && inclinePercent.trim() !== "") {
        const incline = parseFloat(inclinePercent)
        if (!Number.isNaN(incline) && incline >= 0)
          setPayload.incline_percent = incline
      }

      const { error: sErr } = await supabase
        .from("set_logs")
        .insert(setPayload)
      if (sErr) throw sErr

      return workoutLog.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-workouts"] })
      queryClient.invalidateQueries({ queryKey: ["weekly-calories"] })
      queryClient.invalidateQueries({ queryKey: ["recent-workouts"] })
      setOpen(false)
      resetForm()
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
            <Label htmlFor="ql-duration">Duration</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  id="ql-duration"
                  type="number"
                  min={0}
                  max={300}
                  placeholder="min"
                  aria-label="Minutes"
                  value={durationMins}
                  onChange={(e) => setDurationMins(e.target.value)}
                  autoFocus
                />
              </div>
              <span className="text-gray-400">:</span>
              <div className="flex-1">
                <Input
                  id="ql-duration-secs"
                  type="number"
                  min={0}
                  max={59}
                  placeholder="sec"
                  aria-label="Seconds"
                  value={durationSecs}
                  onChange={(e) => setDurationSecs(e.target.value)}
                />
              </div>
            </div>
          </div>

          {isDistanceCardio && (
            <div className="space-y-2">
              <Label htmlFor="ql-distance">Distance (miles)</Label>
              <Input
                id="ql-distance"
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 1"
                value={distanceMiles}
                onChange={(e) => setDistanceMiles(e.target.value)}
              />
            </div>
          )}

          {isTreadmill && (
            <div className="space-y-2">
              <Label htmlFor="ql-incline">Incline (%)</Label>
              <Input
                id="ql-incline"
                type="number"
                min={0}
                max={40}
                step="0.5"
                placeholder="e.g. 1"
                value={inclinePercent}
                onChange={(e) => setInclinePercent(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label>When</Label>
            <BackdateChips value={finishedAt} onChange={setFinishedAt} />
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
              disabled={mutation.isPending || totalMins <= 0}
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
