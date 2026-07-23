"use client"

import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Camera, Loader2, RefreshCw } from "lucide-react"
import { fileToProcessedImage, type ProcessedImage } from "@/lib/image-resize"
import {
  macroConsistency,
  scaleEstimate,
  type FoodEstimate,
} from "@/lib/food-estimate"
import { classifyMealGl, GL_WALK_TIP } from "@/lib/glycemic-load"
import { BackdateChips, nowLocalDatetimeString } from "./BackdateChips"

const supabase = createClient()

type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "meal"

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack", "meal"]

/** uuid without pulling in a dep — crypto.randomUUID is in all target browsers. */
function uuid(): string {
  return crypto.randomUUID()
}

export function QuickLogFood() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<"idle" | "estimating" | "review">("idle")
  const [error, setError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<FoodEstimate | null>(null)
  const [original, setOriginal] = useState<FoodEstimate | null>(null)
  const [mealType, setMealType] = useState<MealType>("meal")
  const [image, setImage] = useState<ProcessedImage | null>(null)
  const [manualText, setManualText] = useState("")
  const [factor, setFactor] = useState(1)
  const [reestimating, setReestimating] = useState(false)
  const [reestimateError, setReestimateError] = useState<string | null>(null)
  // When the meal was eaten. Defaults to now; the user can backdate a meal
  // they forgot to log. datetime-local (local) string; converted to UTC on save.
  const [loggedAt, setLoggedAt] = useState(nowLocalDatetimeString)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  function reset() {
    setPhase("idle")
    setError(null)
    setEstimate(null)
    setOriginal(null)
    setImage(null)
    setManualText("")
    setMealType("meal")
    setFactor(1)
    setReestimateError(null)
    setLoggedAt(nowLocalDatetimeString())
  }

  /** Scale the original estimate by a portion multiplier. */
  function applyFactor(f: number) {
    if (!original) return
    setFactor(f)
    setEstimate(scaleEstimate(original, f))
  }

  /** Send a photo, a typed description, or both to the estimate API. Split
   *  out from handleFile so a network drop can be retried without re-taking
   *  the shot. */
  async function runEstimate(
    processed: ProcessedImage | null,
    correction?: string
  ) {
    setError(null)
    setPhase("estimating")
    try {
      const res = await fetch("/api/estimate-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(processed && {
            imageBase64: processed.base64,
            mediaType: processed.mediaType,
          }),
          ...(correction && { correction }),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "Could not analyze the photo.")
      }
      const body = (await res.json()) as { estimate: FoodEstimate }
      setEstimate(body.estimate)
      setOriginal(body.estimate)
      setPhase("review")
    } catch (err) {
      // A dropped connection surfaces as fetch's "Load failed" / "Failed to
      // fetch" — translate that into something actionable.
      const msg = (err as Error).message
      const friendly = /load failed|failed to fetch|networkerror/i.test(msg)
        ? "Couldn’t reach the server — check your connection and try again."
        : msg
      setError(friendly)
      setPhase("idle")
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setPhase("estimating")
    try {
      const processed = await fileToProcessedImage(file)
      setImage(processed)
      await runEstimate(processed)
    } catch (err) {
      setError((err as Error).message)
      setPhase("idle")
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  /** Re-run the estimate with the user's corrected description. Any photo
   *  goes along for portion sizing; the text overrides what the food is. */
  async function reestimate() {
    if (!estimate) return
    setReestimating(true)
    setReestimateError(null)
    try {
      const res = await fetch("/api/estimate-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(image && {
            imageBase64: image.base64,
            mediaType: image.mediaType,
          }),
          correction: estimate.description.trim(),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "Could not re-estimate. Try again.")
      }
      const body = (await res.json()) as { estimate: FoodEstimate }
      setEstimate(body.estimate)
      setOriginal(body.estimate)
      setFactor(1)
    } catch (err) {
      setReestimateError((err as Error).message)
    } finally {
      setReestimating(false)
    }
  }

  function patch(field: keyof FoodEstimate, value: string) {
    if (!estimate) return
    const numeric =
      field === "calories" ||
      field === "protein_g" ||
      field === "carbs_g" ||
      field === "fat_g" ||
      field === "sugar_g"
    // A manual edit means the numbers no longer match a clean multiplier.
    if (numeric) setFactor(0)
    setEstimate({
      ...estimate,
      [field]: numeric ? Math.max(0, Math.round(Number(value) || 0)) : value,
    })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!estimate) throw new Error("Nothing to save")
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Upload the photo (best-effort — a failed upload still logs the meal).
      let imagePath: string | null = null
      if (image?.blob) {
        const path = `${user.id}/${uuid()}.jpg`
        const { error: upErr } = await supabase.storage
          .from("meal-photos")
          .upload(path, image.blob, { contentType: "image/jpeg" })
        if (!upErr) imagePath = path
      }

      const edited =
        !!original &&
        (original.calories !== estimate.calories ||
          original.protein_g !== estimate.protein_g ||
          original.carbs_g !== estimate.carbs_g ||
          original.fat_g !== estimate.fat_g ||
          original.sugar_g !== estimate.sugar_g ||
          original.description !== estimate.description)

      const when = loggedAt ? new Date(loggedAt) : new Date()
      if (Number.isNaN(when.getTime())) throw new Error("Invalid date")

      const { error: insErr } = await supabase.from("food_logs").insert({
        user_id: user.id,
        description: estimate.description,
        meal_type: mealType,
        calories: estimate.calories,
        protein_g: estimate.protein_g,
        carbs_g: estimate.carbs_g,
        fat_g: estimate.fat_g,
        sugar_g: estimate.sugar_g,
        glycemic_load: estimate.glycemic_load,
        image_path: imagePath,
        confidence: estimate.confidence,
        edited,
        logged_at: when.toISOString(),
      })
      if (insErr) throw insErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs-today"] })
      queryClient.invalidateQueries({ queryKey: ["weekly-calories"] })
      setOpen(false)
      reset()
    },
  })

  const inconsistent = estimate ? macroConsistency(estimate) > 0.25 : false

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <button
        onClick={() => setOpen(true)}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
      >
        <Camera className="h-4 w-4" />
        Snap Meal
      </button>
      <DialogContent className="mx-4 max-w-sm">
        <DialogHeader>
          <DialogTitle>Log a Meal</DialogTitle>
          <DialogDescription>
            Take a photo or describe the meal — Claude estimates the calories
            and macros. Check the numbers and adjust before saving.
          </DialogDescription>
        </DialogHeader>

        {/* No `capture` attribute: on iOS it would force the camera open
            directly, hiding the Photo Library option this button promises. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        {phase === "idle" && (
          <div className="mt-4 space-y-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-8 text-gray-500 transition-colors hover:border-purple-300 hover:text-purple-600"
            >
              <Camera className="h-8 w-8" />
              <span className="text-sm font-medium">Take or choose a photo</span>
            </button>

            <div className="flex items-center gap-3 text-xs uppercase text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              or
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            {/* No photo handy (or none exists): type the meal and estimate
                from the description alone. */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const text = manualText.trim()
                if (text) runEstimate(null, text)
              }}
              className="flex gap-2"
            >
              <Input
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder='Describe it — e.g. "fried chicken thigh"'
                aria-label="Meal description"
              />
              <button
                type="submit"
                disabled={!manualText.trim()}
                className="shrink-0 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Estimate
              </button>
            </form>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {error && image && (
              <button
                onClick={() => runEstimate(image)}
                className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                Try again with the same photo
              </button>
            )}
          </div>
        )}

        {phase === "estimating" && (
          <div className="flex flex-col items-center gap-2 py-10 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Analyzing your meal…</p>
          </div>
        )}

        {phase === "review" && estimate && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveMutation.mutate()
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="qlf-desc">Meal</Label>
              {/* Textarea, not Input: descriptions routinely overflow a
                  single line and the review step is pointless if you can't
                  read what you're reviewing. Newlines are stripped so the
                  value stays a one-line description. */}
              <Textarea
                id="qlf-desc"
                rows={2}
                className="min-h-0 resize-none"
                value={estimate.description}
                onChange={(e) =>
                  patch("description", e.target.value.replace(/\n/g, " "))
                }
              />
              {/* The numbers don't track description edits by themselves —
                  offer a re-estimate once the text differs from the model's. */}
              {original &&
                estimate.description.trim() !== original.description.trim() && (
                  <button
                    type="button"
                    onClick={reestimate}
                    disabled={reestimating || !estimate.description.trim()}
                    className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${reestimating ? "animate-spin" : ""}`}
                    />
                    {reestimating
                      ? "Re-estimating…"
                      : "Update numbers from description"}
                  </button>
                )}
              {reestimateError && (
                <p className="text-xs text-red-600">{reestimateError}</p>
              )}
              {estimate.confidence === "low" && (
                <p className="text-xs text-amber-600">
                  Low confidence — portion size was hard to judge. Use the
                  buttons below or edit the numbers if you know better.
                </p>
              )}
            </div>

            {/* Assumed portion + one-tap multiplier to correct it */}
            {original && (
              <div className="space-y-2 rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">
                  Estimated for{" "}
                  <span className="font-medium text-gray-900">
                    {original.portion || "a typical serving"}
                  </span>
                  . Wrong portion? Scale it:
                </p>
                <div className="flex gap-1.5">
                  {[0.5, 1, 1.5, 2].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => applyFactor(f)}
                      className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                        factor === f
                          ? "bg-purple-600 text-white"
                          : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {f === 1 ? "1×" : `${f}×`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Numeric fields render 0 as empty and select-all on focus.
                Otherwise clearing a controlled number input snaps back to a
                sticky "0" and typing 460 produces "0460". */}
            <div className="space-y-2">
              <Label htmlFor="qlf-cal">Calories</Label>
              <Input
                id="qlf-cal"
                type="number"
                min={0}
                placeholder="0"
                value={estimate.calories === 0 ? "" : estimate.calories}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => patch("calories", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label htmlFor="qlf-p" className="text-xs">
                  Protein (g)
                </Label>
                <Input
                  id="qlf-p"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={estimate.protein_g === 0 ? "" : estimate.protein_g}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => patch("protein_g", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qlf-c" className="text-xs">
                  Carbs (g)
                </Label>
                <Input
                  id="qlf-c"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={estimate.carbs_g === 0 ? "" : estimate.carbs_g}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => patch("carbs_g", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qlf-f" className="text-xs">
                  Fat (g)
                </Label>
                <Input
                  id="qlf-f"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={estimate.fat_g === 0 ? "" : estimate.fat_g}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => patch("fat_g", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qlf-s" className="text-xs">
                  Sugar (g)
                </Label>
                <Input
                  id="qlf-s"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={estimate.sugar_g === 0 ? "" : estimate.sugar_g}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => patch("sugar_g", e.target.value)}
                />
              </div>
            </div>

            {/* Glucose-impact guidance from glycemic load — a food
                property, deliberately not a blood-sugar estimate. */}
            {estimate.glycemic_load > 0 && (
              <p className="text-xs text-gray-500">
                Glucose impact:{" "}
                <span
                  className={`font-semibold ${
                    classifyMealGl(estimate.glycemic_load) === "high"
                      ? "text-red-600"
                      : classifyMealGl(estimate.glycemic_load) === "medium"
                        ? "text-amber-600"
                        : "text-emerald-600"
                  }`}
                >
                  {classifyMealGl(estimate.glycemic_load)}
                </span>{" "}
                (GL {estimate.glycemic_load})
                {classifyMealGl(estimate.glycemic_load) === "high" &&
                  ` — ${GL_WALK_TIP}`}
              </p>
            )}

            {inconsistent && (
              <p className="text-xs text-amber-600">
                The macros don&apos;t quite add up to the calorie total — one of
                them may be off.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="qlf-meal">Meal type</Label>
              <select
                id="qlf-meal"
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm capitalize"
              >
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>When</Label>
              <BackdateChips value={loggedAt} onChange={setLoggedAt} />
            </div>

            {saveMutation.isError && (
              <p className="text-sm text-red-600">
                {(saveMutation.error as Error).message}
              </p>
            )}

            <DialogFooter>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={reset}
              >
                Retake
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? "Saving…" : "Save meal"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
