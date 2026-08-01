"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Timer } from "lucide-react"
import {
  cooperVo2Max,
  cooperWorkoutPayload,
  cooperDistanceToMeters,
  metersToMiles,
  type DistanceUnit,
  type FitnessTestType,
} from "@/lib/fitness-tests"
import { saveWorkout } from "@/lib/save-workout"
import { addPending, localStorageQueue } from "@/lib/pending-workouts"
import { invalidateWorkoutData } from "@/lib/queries/invalidate"
import { queryKeys } from "@/lib/queries/keys"
import { localToday } from "@/lib/dates"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { QuickLogDialog } from "@/components/activity/QuickLogDialog"

const supabase = createClient()

export function QuickLogFitnessTest() {
  const [open, setOpen] = useState(false)
  const [testType, setTestType] = useState<FitnessTestType>("cooper_run")
  const [result, setResult] = useState("")
  const [testedAt, setTestedAt] = useState(localToday)
  // Miles by default: the rest of the app is imperial and treadmills here
  // read in miles. Storage stays metric — see cooperDistanceToMeters.
  const [unit, setUnit] = useState<DistanceUnit>("mi")
  const queryClient = useQueryClient()

  const isCooper = testType === "cooper_run"
  const resultNum = parseFloat(result)
  const isMiles = unit === "mi"
  /** The Cooper distance in meters, whichever unit was typed. */
  const distanceMeters = isCooper
    ? cooperDistanceToMeters(resultNum, unit)
    : null
  const previewVo2 = distanceMeters != null ? cooperVo2Max(distanceMeters) : null

  const mutation = useMutation({
    mutationFn: async () => {
      if (isCooper && distanceMeters == null) {
        throw new Error("Enter a valid distance")
      }
      if (!isCooper && (!Number.isFinite(resultNum) || resultNum <= 0)) {
        throw new Error("Enter a valid rep count")
      }
      // Always stored in meters, whatever the input unit was.
      const storedResult = isCooper ? distanceMeters! : resultNum

      const userId = await getAuthUserId()

      const { error } = await supabase.from("fitness_tests").insert({
        user_id: userId,
        test_type: testType,
        result: storedResult,
        tested_at: testedAt,
      })
      if (error) throw error

      // A Cooper test replaces that day's session, so it has to count as one:
      // toward the week's total, the streak, calories, and — outside the three
      // designated test weeks — so the missed-session detector doesn't flag the
      // slot you just went maximal on. The pull-up max is deliberately not
      // converted; it rides inside a Pull A session that gets logged already.
      if (isCooper) {
        const payload = cooperWorkoutPayload({
          userId,
          distanceMeters: storedResult,
          testedAt,
        })
        try {
          await saveWorkout(supabase, payload)
        } catch {
          // Don't fail the mutation — the test result is the thing that must
          // not be lost, and making the user re-enter a maximal effort is a
          // worse outcome than a delayed workout row.
          //
          // But don't swallow it either. Swallowing is what made this
          // invisible: a Cooper that failed to become a workout looked
          // identical to one that never tried, and the week's total was just
          // quietly wrong. Queue it instead, so OfflineSyncManager retries it
          // and its pending pill says something is outstanding.
          addPending(localStorageQueue, {
            id: crypto.randomUUID(),
            queuedAt: new Date().toISOString(),
            payload,
          })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fitness-tests"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.ouraVo2History })
      invalidateWorkoutData(queryClient)
      setOpen(false)
      setResult("")
      setTestedAt(localToday())
    },
  })

  const typeButtonClass = (selected: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      selected
        ? "bg-white text-gray-900 shadow-sm"
        : "text-gray-500 hover:text-gray-700"
    }`

  return (
    <QuickLogDialog
      open={open}
      onOpenChange={setOpen}
      trigger={{ icon: Timer, label: "Log test" }}
      triggerClassName="h-auto flex-none px-3 py-1.5 text-xs"
      triggerIconClassName="h-3.5 w-3.5"
      title="Log Fitness Test"
      description="Record a Cooper 12-minute test or a max pull-up test."
      submitDisabled={!result}
      mutation={mutation}
      onSubmit={() => mutation.mutate()}
    >
        <div className="flex rounded-lg bg-gray-100 p-1" role="group">
          <button
            type="button"
            className={typeButtonClass(isCooper)}
            onClick={() => {
              setTestType("cooper_run")
              setResult("")
            }}
          >
            Cooper 12-min
          </button>
          <button
            type="button"
            className={typeButtonClass(!isCooper)}
            onClick={() => {
              setTestType("pullup_max")
              setResult("")
            }}
          >
            Pull-up max
          </button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="qlft-result">
            {isCooper
              ? `Distance covered (${isMiles ? "miles" : "meters"})`
              : "Strict reps"}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="qlft-result"
              type="number"
              min={isCooper ? 0 : 1}
              max={isCooper ? (isMiles ? 20 : 30000) : 200}
              step={isCooper ? "any" : "1"}
              placeholder={isCooper ? (isMiles ? "e.g. 1.22" : "e.g. 2400") : "e.g. 5"}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              autoFocus
            />
            {isCooper && (
              <div
                className="flex shrink-0 rounded-lg bg-gray-100 p-1"
                role="group"
                aria-label="Distance unit"
              >
                {(["mi", "m"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={unit === u}
                    className={typeButtonClass(unit === u)}
                    onClick={() => setUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}
          </div>
          {previewVo2 != null && distanceMeters != null && (
            <p className="text-xs text-gray-500">
              {/* The converted value is shown so a mis-set unit is obvious
                  before saving rather than after. */}
              {isMiles
                ? `${distanceMeters} m · `
                : `${metersToMiles(distanceMeters)} mi · `}
              Estimated VO2 Max:{" "}
              <span className="font-semibold text-gray-900">
                {previewVo2}
              </span>{" "}
              ml/kg/min
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="qlft-date">Test date</Label>
          <Input
            id="qlft-date"
            type="date"
            max={localToday()}
            value={testedAt}
            onChange={(e) => setTestedAt(e.target.value)}
          />
        </div>

    </QuickLogDialog>
  )
}
