"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Coffee } from "lucide-react"
import { CAFFEINE_PRESETS } from "@/lib/caffeine"
import { lookupCaffeine } from "@/lib/caffeine-foods"
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
  // What the user typed, when they name the drink instead of tapping a chip.
  const [typed, setTyped] = useState("")
  const queryClient = useQueryClient()

  function selectPreset(label: string, presetMg: number) {
    setSource(label)
    setMg(String(presetMg))
    setTyped("")
  }

  /**
   * Naming the drink fills in its caffeine. The presets are one-tap for the
   * drinks you have daily, but they're fixed servings — "Soda" is a 12 oz
   * can, so tapping it for a 32 oz fountain cup logs a third of the real
   * dose. Typing what you actually drank sizes it properly.
   */
  function typeDrink(value: string) {
    setTyped(value)
    const known = lookupCaffeine(value)
    if (!known) {
      // Unrecognized: keep whatever mg is in the box, but the label the user
      // typed is still the better description of what they drank.
      setSource(value.trim() || null)
      return
    }
    setSource(value.trim())
    setMg(String(known.mg))
  }

  const typedMatch = typed.trim() ? lookupCaffeine(typed) : null

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
      setTyped("")
    },
  })

  return (
    <QuickLogDialog
      open={open}
      onOpenChange={setOpen}
      trigger={{ icon: Coffee, label: "Log Caffeine" }}
      title="Log Caffeine"
      description="Timing matters — a late one can cut into tonight's sleep."
      // A zero is a real answer for a caffeine-free drink, but there's no row
      // to write for it — caffeine_logs requires mg > 0.
      submitDisabled={!mg || !Number.isFinite(mgNum) || mgNum <= 0}
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
        <Label htmlFor="qlc-drink">Or name it</Label>
        <Input
          id="qlc-drink"
          value={typed}
          onChange={(e) => typeDrink(e.target.value)}
          placeholder='e.g. "32 oz Dr Pepper" or "16 oz cold brew"'
        />
        {typedMatch && typedMatch.mg > 0 && (
          <p className="text-xs text-gray-500">
            Typical for {typedMatch.label}
            {typedMatch.oz ? ` at ${+typedMatch.oz.toFixed(1)} oz` : ""}.
          </p>
        )}
        {typedMatch && typedMatch.mg === 0 && (
          <p className="text-xs text-emerald-700">
            {typedMatch.label} has no caffeine — nothing to log.
          </p>
        )}
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
            // A hand-typed number no longer matches the preset it came from,
            // but a drink the user named themselves is still what they drank.
            setSource(typed.trim() || null)
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
