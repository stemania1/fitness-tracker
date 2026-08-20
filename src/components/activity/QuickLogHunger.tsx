"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Label } from "@/components/ui/label"
import { Utensils } from "lucide-react"
import { HUNGER_LEVELS } from "@/lib/satiety"
import { BackdateChips, nowLocalDatetimeString } from "./BackdateChips"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { QuickLogDialog } from "@/components/activity/QuickLogDialog"
import { queryKeys } from "@/lib/queries/keys"

const supabase = createClient()

/**
 * Log hunger on its own, with no meal attached.
 *
 * The meal logger already asks how hungry you were before eating, which
 * measures the gap that just ended. But that question can only ever be asked
 * at the moments you happen to eat, and the informative moment is usually
 * earlier: a breakfast that failed shows up as being ravenous at 10:30, not
 * as a mild reading at noon. Waiting for the next meal rounds that off, and
 * for the last meal of the day there is no next meal at all — dinner was
 * invisible to the analysis entirely.
 *
 * Deliberately one tap and done. This gets used mid-morning with a phone in
 * one hand or it does not get used.
 */
export function QuickLogHunger() {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<number | null>(null)
  // Defaults to now. Hunger is worth backdating for the same reason a meal
  // is: you notice you were starving an hour ago, once you've eaten.
  const [loggedAt, setLoggedAt] = useState(nowLocalDatetimeString)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (level == null) throw new Error("Pick how hungry you are")
      const userId = await getAuthUserId()

      const when = loggedAt ? new Date(loggedAt) : new Date()
      if (Number.isNaN(when.getTime())) throw new Error("Invalid date")

      const { error } = await supabase.from("hunger_logs").insert({
        user_id: userId,
        level,
        logged_at: when.toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hungerLogs })
      setOpen(false)
      setLevel(null)
      setLoggedAt(nowLocalDatetimeString())
    },
  })

  return (
    <QuickLogDialog
      open={open}
      onOpenChange={setOpen}
      trigger={{ icon: Utensils, label: "Log Hunger" }}
      title="Log Hunger"
      description="How hungry are you right now? Rates how well your last meal held you."
      submitDisabled={level == null}
      mutation={mutation}
      onSubmit={() => mutation.mutate()}
    >
      <div className="space-y-2">
        <Label>Right now</Label>
        <div className="flex gap-1.5">
          {HUNGER_LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={level === l.value}
              onClick={() => setLevel(level === l.value ? null : l.value)}
              className={`min-h-11 flex-1 rounded-lg px-1 py-2 text-xs font-medium transition-colors ${
                level === l.value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>When</Label>
        <BackdateChips value={loggedAt} onChange={setLoggedAt} />
      </div>
    </QuickLogDialog>
  )
}
