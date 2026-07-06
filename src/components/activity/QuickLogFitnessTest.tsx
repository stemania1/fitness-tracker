"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
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
import { Timer } from "lucide-react"
import { cooperVo2Max, type FitnessTestType } from "@/lib/fitness-tests"

const supabase = createClient()

/** Today as YYYY-MM-DD in the user's local timezone. */
function localToday(): string {
  return new Date().toLocaleDateString("en-CA")
}

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

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase.from("fitness_tests").insert({
        user_id: user.id,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 transition-colors hover:bg-gray-50">
        <Timer className="h-3.5 w-3.5" />
        Log test
      </DialogTrigger>
      <DialogContent className="mx-4 max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Fitness Test</DialogTitle>
          <DialogDescription>
            Record a Cooper 12-minute test or a max pull-up test.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
          className="mt-4 space-y-4"
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
              disabled={mutation.isPending || !result}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
