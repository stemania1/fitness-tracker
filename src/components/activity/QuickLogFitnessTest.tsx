"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Timer } from "lucide-react"
import { cooperVo2Max, type FitnessTestType } from "@/lib/fitness-tests"
import { localToday } from "@/lib/dates"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { QuickLogDialog } from "@/components/activity/QuickLogDialog"

const supabase = createClient()

export function QuickLogFitnessTest() {
  const [open, setOpen] = useState(false)
  const [testType, setTestType] = useState<FitnessTestType>("cooper_run")
  const [result, setResult] = useState("")
  const [testedAt, setTestedAt] = useState(localToday)
  const queryClient = useQueryClient()

  const isCooper = testType === "cooper_run"
  const resultNum = parseFloat(result)
  const previewVo2 =
    isCooper && Number.isFinite(resultNum) ? cooperVo2Max(resultNum) : null

  const mutation = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(resultNum) || resultNum <= 0) {
        throw new Error(
          isCooper ? "Enter a valid distance" : "Enter a valid rep count"
        )
      }

      const userId = await getAuthUserId()

      const { error } = await supabase.from("fitness_tests").insert({
        user_id: userId,
        test_type: testType,
        result: resultNum,
        tested_at: testedAt,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fitness-tests"] })
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
            {isCooper ? "Distance covered (meters)" : "Strict reps"}
          </Label>
          <Input
            id="qlft-result"
            type="number"
            min={1}
            max={isCooper ? 9999 : 200}
            step={isCooper ? "any" : "1"}
            placeholder={isCooper ? "e.g. 2400" : "e.g. 5"}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            autoFocus
          />
          {previewVo2 != null && (
            <p className="text-xs text-gray-500">
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
