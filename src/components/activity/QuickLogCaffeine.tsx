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
import { Coffee } from "lucide-react"
import { CAFFEINE_PRESETS } from "@/lib/caffeine"
import { BackdateChips, nowLocalDatetimeString } from "./BackdateChips"

const supabase = createClient()

export function QuickLogCaffeine() {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<string | null>("Coffee")
  const [mg, setMg] = useState("95")
  // When it was consumed. Defaults to now; can be backdated to a drink you
  // forgot to log. datetime-local (local) string; converted to UTC on save.
  const [loggedAt, setLoggedAt] = useState(nowLocalDatetimeString)
  const queryClient = useQueryClient()

  function selectPreset(label: string, presetMg: number) {
    setSource(label)
    setMg(String(presetMg))
  }

  const mgNum = parseInt(mg, 10)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(mgNum) || mgNum <= 0) {
        throw new Error("Enter a valid caffeine amount")
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const when = loggedAt ? new Date(loggedAt) : new Date()
      if (Number.isNaN(when.getTime())) throw new Error("Invalid date")

      const { error } = await supabase.from("caffeine_logs").insert({
        user_id: user.id,
        mg: mgNum,
        source,
        logged_at: when.toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caffeine-today"] })
      setOpen(false)
      setLoggedAt(nowLocalDatetimeString())
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50">
        <Coffee className="h-4 w-4" />
        Log Caffeine
      </DialogTrigger>
      <DialogContent className="mx-4 max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Caffeine</DialogTitle>
          <DialogDescription>
            Timing matters — a late one can cut into tonight&apos;s sleep.
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
            <Label>Drink</Label>
            <div className="flex flex-wrap gap-1.5">
              {CAFFEINE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => selectPreset(p.label, p.mg)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    source === p.label
                      ? "border-amber-400 bg-amber-50 text-amber-800"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {p.label}
                  <span className="ml-1 text-gray-400">{p.mg}mg</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qlc-mg">Caffeine (mg)</Label>
            <Input
              id="qlc-mg"
              type="number"
              min={1}
              max={1000}
              step="1"
              value={mg}
              onChange={(e) => {
                setMg(e.target.value)
                setSource(null)
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>When</Label>
            <BackdateChips value={loggedAt} onChange={setLoggedAt} />
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
              disabled={mutation.isPending || !mg}
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
