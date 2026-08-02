"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Coffee } from "lucide-react"
import { CAFFEINE_PRESETS } from "@/lib/caffeine"
import { BackdateChips, nowLocalDatetimeString } from "./BackdateChips"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { QuickLogDialog } from "@/components/activity/QuickLogDialog"

const supabase = createClient()

export function QuickLogCaffeine() {
  const [open, setOpen] = useState(false)
  // Opens on the first preset, which is the most-used one — the morning
  // thermos. Read from the list rather than duplicated, so reordering the
  // presets moves the default with them.
  const [source, setSource] = useState<string | null>(CAFFEINE_PRESETS[0].label)
  const [mg, setMg] = useState(String(CAFFEINE_PRESETS[0].mg))
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
      const userId = await getAuthUserId()

      const when = loggedAt ? new Date(loggedAt) : new Date()
      if (Number.isNaN(when.getTime())) throw new Error("Invalid date")

      const { error } = await supabase.from("caffeine_logs").insert({
        user_id: userId,
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
    <QuickLogDialog
      open={open}
      onOpenChange={setOpen}
      trigger={{ icon: Coffee, label: "Log Caffeine" }}
      title="Log Caffeine"
      description="Timing matters — a late one can cut into tonight's sleep."
      submitDisabled={!mg}
      mutation={mutation}
      onSubmit={() => mutation.mutate()}
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
    </QuickLogDialog>
  )
}
