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
import { Scale } from "lucide-react"

const supabase = createClient()

export function QuickLogWeight() {
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState("")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const weightNum = parseFloat(weight)
      if (!weightNum || weightNum <= 0) throw new Error("Enter a valid weight")

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Insert into weight_logs
      const { error: insertError } = await supabase
        .from("weight_logs")
        .insert({
          user_id: user.id,
          weight: weightNum,
          logged_at: new Date().toISOString(),
        })
      if (insertError) throw insertError

      // Update current_weight on user_profiles
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ current_weight: weightNum })
        .eq("id", user.id)
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50">
        <Scale className="h-4 w-4" />
        Log Weight
      </DialogTrigger>
      <DialogContent className="mx-4 max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Weight</DialogTitle>
          <DialogDescription>
            Record today&apos;s weigh-in.
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
              disabled={mutation.isPending || !weight}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Saving\u2026" : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
