"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Footprints } from "lucide-react"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { QuickLogDialog } from "@/components/activity/QuickLogDialog"
import { localToday, shiftDateString, formatMediumDate } from "@/lib/dates"

const supabase = createClient()

/**
 * Hand-enter a day's steps and moderate+ minutes.
 *
 * For days the ring wasn't worn, which the Daily Movement card otherwise has
 * nothing to say about. Both fields are optional — a phone's step count is
 * the usual reason to open this, and few sources report active minutes — so
 * either alone is a valid entry.
 *
 * Yesterday is offered alongside today because the realistic moment to
 * remember an unworn day is the following morning.
 */
export function QuickLogSteps() {
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState(localToday)
  const [steps, setSteps] = useState("")
  const [minutes, setMinutes] = useState("")
  const queryClient = useQueryClient()

  const yesterday = shiftDateString(localToday(), -1)

  const mutation = useMutation({
    mutationFn: async () => {
      const stepsNum = steps.trim() === "" ? null : parseInt(steps, 10)
      const minutesNum = minutes.trim() === "" ? null : parseInt(minutes, 10)

      if (stepsNum == null && minutesNum == null) {
        throw new Error("Enter steps, active minutes, or both")
      }
      if (stepsNum != null && (!Number.isFinite(stepsNum) || stepsNum < 0)) {
        throw new Error("Steps must be zero or more")
      }
      if (minutesNum != null && (!Number.isFinite(minutesNum) || minutesNum < 0)) {
        throw new Error("Active minutes must be zero or more")
      }

      const userId = await getAuthUserId()
      // Upsert, so re-logging a day corrects it rather than failing on the
      // unique constraint or stacking duplicate rows.
      const { error } = await supabase.from("manual_activity_logs").upsert(
        {
          user_id: userId,
          day,
          steps: stepsNum,
          active_minutes: minutesNum,
        },
        { onConflict: "user_id,day" }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movement-history"] })
      queryClient.invalidateQueries({ queryKey: ["manual-activity"] })
      setOpen(false)
      setSteps("")
      setMinutes("")
      setDay(localToday())
    },
  })

  return (
    <QuickLogDialog
      open={open}
      onOpenChange={setOpen}
      trigger={{ icon: Footprints, label: "Log Steps" }}
      title="Log Movement"
      description="For a day your ring wasn't on. Ring data always wins where it exists."
      submitDisabled={!steps && !minutes}
      mutation={mutation}
      onSubmit={() => mutation.mutate()}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Day</Label>
          <div className="flex gap-2">
            {[
              { value: localToday(), label: "Today" },
              { value: yesterday, label: "Yesterday" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDay(option.value)}
                className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  day === option.value
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {day !== localToday() && day !== yesterday && (
            <p className="text-xs text-gray-400">{formatMediumDate(day)}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="qls-steps">Steps</Label>
          <Input
            id="qls-steps"
            type="number"
            min={0}
            max={200000}
            step="100"
            placeholder="e.g. 7500"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="qls-minutes">Active minutes (optional)</Label>
          <Input
            id="qls-minutes"
            type="number"
            min={0}
            max={1440}
            step="5"
            placeholder="e.g. 30"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
          <p className="text-xs text-gray-400">
            Minutes at moderate or higher effort — a brisk walk upward, not
            time on your feet.
          </p>
        </div>
      </div>
    </QuickLogDialog>
  )
}
