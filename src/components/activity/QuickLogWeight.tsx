"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Scale } from "lucide-react"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { QuickLogDialog } from "@/components/activity/QuickLogDialog"
import { BackdateChips, nowLocalDatetimeString } from "./BackdateChips"
import { localDateString, localToday } from "@/lib/dates"

const supabase = createClient()

export function QuickLogWeight() {
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState("")
  // When the weigh-in happened. Defaults to now; editable so a morning
  // weigh-in logged at night keeps its real time. datetime-local (local)
  // string; converted to UTC on save.
  const [loggedAt, setLoggedAt] = useState(nowLocalDatetimeString)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const weightNum = parseFloat(weight)
      if (!weightNum || weightNum <= 0) throw new Error("Enter a valid weight")

      const when = loggedAt ? new Date(loggedAt) : new Date()
      if (Number.isNaN(when.getTime())) throw new Error("Invalid date")

      const userId = await getAuthUserId()

      // Insert into weight_logs
      const { error: insertError } = await supabase
        .from("weight_logs")
        .insert({
          user_id: userId,
          weight: weightNum,
          logged_at: when.toISOString(),
        })
      if (insertError) throw insertError

      // Only a weigh-in dated today becomes the profile's current weight — a
      // backdated entry is older than whatever the profile already shows.
      if (localDateString(when) === localToday()) {
        const { error: updateError } = await supabase
          .from("user_profiles")
          .update({ current_weight: weightNum })
          .eq("id", userId)
        if (updateError) throw updateError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight-logs-recent"] })
      queryClient.invalidateQueries({ queryKey: ["latest-weight"] })
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      setOpen(false)
      setWeight("")
      setLoggedAt(nowLocalDatetimeString())
    },
  })

  return (
    <QuickLogDialog
      open={open}
      onOpenChange={setOpen}
      trigger={{ icon: Scale, label: "Log Weight" }}
      title="Log Weight"
      description="Record a weigh-in."
      submitDisabled={!weight}
      mutation={mutation}
      onSubmit={() => mutation.mutate()}
    >
      <div className="space-y-2">
        <Label htmlFor="qlw-weight">Weight (lbs)</Label>
        <Input
          id="qlw-weight"
          type="number"
          min={1}
          max={999}
          step="0.1"
          placeholder="e.g. 185"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label>When</Label>
        <BackdateChips value={loggedAt} onChange={setLoggedAt} />
      </div>
    </QuickLogDialog>
  )
}
