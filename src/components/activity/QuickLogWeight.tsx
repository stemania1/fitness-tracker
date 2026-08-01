"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Scale } from "lucide-react"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { QuickLogDialog } from "@/components/activity/QuickLogDialog"

const supabase = createClient()

export function QuickLogWeight() {
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState("")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const weightNum = parseFloat(weight)
      if (!weightNum || weightNum <= 0) throw new Error("Enter a valid weight")

      const userId = await getAuthUserId()

      // Insert into weight_logs
      const { error: insertError } = await supabase
        .from("weight_logs")
        .insert({
          user_id: userId,
          weight: weightNum,
          logged_at: new Date().toISOString(),
        })
      if (insertError) throw insertError

      // Update current_weight on user_profiles
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ current_weight: weightNum })
        .eq("id", userId)
      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight-logs-recent"] })
      queryClient.invalidateQueries({ queryKey: ["latest-weight"] })
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      setOpen(false)
      setWeight("")
    },
  })

  return (
    <QuickLogDialog
      open={open}
      onOpenChange={setOpen}
      trigger={{ icon: Scale, label: "Log Weight" }}
      title="Log Weight"
      description="Record today's weigh-in."
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

    </QuickLogDialog>
  )
}
