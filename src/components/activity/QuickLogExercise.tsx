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

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name)

const cardioExercises = exerciseCatalog
  .filter((e) => e.exerciseType === "cardio")
  .sort(byName)
const strengthExercises = exerciseCatalog
  .filter((e) => e.exerciseType === "strength")
  .sort(byName)

// The picker preselects a cardio exercise, so its mm:ss/distance/incline path
// stays the default. Anchor on the catalog's first cardio entry.
const defaultExerciseId =
  exerciseCatalog.find((e) => e.exerciseType === "cardio")?.id ?? ""

export function QuickLogExercise() {
  const [open, setOpen] = useState(false)
  const [exerciseId, setExerciseId] = useState(defaultExerciseId)
  const [durationMins, setDurationMins] = useState("")
  const [durationSecs, setDurationSecs] = useState("")
  const [distanceMiles, setDistanceMiles] = useState("")
  const [inclinePercent, setInclinePercent] = useState("")
  const [sets, setSets] = useState("")
  const [reps, setReps] = useState("")
  const [weight, setWeight] = useState("")
  const [finishedAt, setFinishedAt] = useState<string>(
    nowLocalDatetimeString()
  )
  const queryClient = useQueryClient()

  const selectedExercise = exerciseCatalog.find((e) => e.id === exerciseId)
  const isStrength = selectedExercise?.exerciseType === "strength"
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

  const setsCount = parseInt(sets || "0", 10)
  const repsCount = parseInt(reps || "0", 10)

  // Strength needs at least one set of one rep; cardio needs a duration.
  const canSubmit = isStrength
    ? setsCount > 0 && repsCount > 0
    : totalMins > 0

  function resetForm() {
    setDurationMins("")
    setDurationSecs("")
    setDistanceMiles("")
    setInclinePercent("")
    setSets("")
    setReps("")
    setWeight("")
    setExerciseId(defaultExerciseId)
    setFinishedAt(nowLocalDatetimeString())
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!canSubmit) {
        throw new Error(
          isStrength ? "Enter sets and reps" : "Enter a valid duration"
        )
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const exerciseName = selectedExercise?.name ?? "Workout"

      // Resolve static slug ID to database UUID
      const idMap = await ensureExercisesExist(supabase, [exerciseId])
      const dbExerciseId = idMap.get(exerciseId)
      if (!dbExerciseId) throw new Error("Exercise not found in database")

      const finished = finishedAt ? new Date(finishedAt) : new Date()
      if (Number.isNaN(finished.getTime())) {
        throw new Error("Invalid date")
      }
      // Cardio derives a start time from its duration; a strength set has no
      // elapsed clock, so it starts and finishes at the same instant.
      const startedAt = isStrength
        ? finished
        : new Date(finished.getTime() - totalMins * 60_000)

      // Create workout log. Cardio carries a whole-minute duration; strength
      // leaves it null since reps/weight live on the sets below.
      const { data: workoutLog, error: wErr } = await supabase
        .from("workout_logs")
        .insert({
          user_id: user.id,
          name: exerciseName,
          started_at: startedAt.toISOString(),
          finished_at: finished.toISOString(),
          duration_mins: isStrength ? null : Math.max(1, Math.round(totalMins)),
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

      if (isStrength) {
        // One row per set, all sharing the entered reps and (optional) weight.
        const parsedWeight =
          weight.trim() !== "" ? parseFloat(weight) : undefined
        const hasWeight =
          parsedWeight !== undefined &&
          !Number.isNaN(parsedWeight) &&
          parsedWeight > 0
        const rows = Array.from({ length: setsCount }, (_, i) => ({
          exercise_log_id: exerciseLog.id,
          set_number: i + 1,
          reps: repsCount,
          ...(hasWeight ? { weight: parsedWeight } : {}),
        }))

        const { error: sErr } = await supabase.from("set_logs").insert(rows)
        if (sErr) throw sErr

        return workoutLog.id
      }

      // Cardio: a single set with duration, plus distance/incline when provided
      // so the detail view can derive pace.
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
            Log a cardio or strength set in seconds.
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
              <optgroup label="Cardio">
                {cardioExercises.map((ex) => (
                  <SelectOption key={ex.id} value={ex.id}>
                    {ex.name}
                  </SelectOption>
                ))}
              </optgroup>
              <optgroup label="Strength">
                {strengthExercises.map((ex) => (
                  <SelectOption key={ex.id} value={ex.id}>
                    {ex.name}
                  </SelectOption>
                ))}
              </optgroup>
            </Select>
          </div>

          {isStrength ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label htmlFor="ql-sets">Sets</Label>
                <Input
                  id="ql-sets"
                  type="number"
                  min={1}
                  max={20}
                  placeholder="3"
                  aria-label="Sets"
                  value={sets}
                  onChange={(e) => setSets(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ql-reps">Reps</Label>
                <Input
                  id="ql-reps"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="10"
                  aria-label="Reps"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ql-weight">Weight</Label>
                <Input
                  id="ql-weight"
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="lbs"
                  aria-label="Weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
            </div>
          ) : (
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
          )}

          {!isStrength && isDistanceCardio && (
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
              disabled={mutation.isPending || !canSubmit}
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
