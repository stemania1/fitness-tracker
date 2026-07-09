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
import { Camera, Loader2 } from "lucide-react"
import { fileToProcessedImage, type ProcessedImage } from "@/lib/image-resize"
import { macroConsistency, type FoodEstimate } from "@/lib/food-estimate"

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
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  function reset() {
    setPhase("idle")
    setError(null)
    setEstimate(null)
    setOriginal(null)
    setImage(null)
    setMealType("meal")
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setPhase("estimating")
    try {
      const processed = await fileToProcessedImage(file)
      setImage(processed)
      const res = await fetch("/api/estimate-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: processed.base64,
          mediaType: processed.mediaType,
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
      setError((err as Error).message)
      setPhase("idle")
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function patch(field: keyof FoodEstimate, value: string) {
    if (!estimate) return
    const numeric =
      field === "calories" ||
      field === "protein_g" ||
      field === "carbs_g" ||
      field === "fat_g"
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
          original.description !== estimate.description)

      const { error: insErr } = await supabase.from("food_logs").insert({
        user_id: user.id,
        description: estimate.description,
        meal_type: mealType,
        calories: estimate.calories,
        protein_g: estimate.protein_g,
        carbs_g: estimate.carbs_g,
        fat_g: estimate.fat_g,
        image_path: imagePath,
        confidence: estimate.confidence,
        edited,
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
            Take a photo — Claude estimates the calories and macros. Check the
            numbers and adjust before saving.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
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
            {error && <p className="text-sm text-red-600">{error}</p>}
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
              <Input
                id="qlf-desc"
                value={estimate.description}
                onChange={(e) => patch("description", e.target.value)}
              />
              {estimate.confidence === "low" && (
                <p className="text-xs text-amber-600">
                  Low confidence — portion size was hard to judge. Adjust if you
                  know better.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="qlf-cal">Calories</Label>
              <Input
                id="qlf-cal"
                type="number"
                min={0}
                value={estimate.calories}
                onChange={(e) => patch("calories", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="qlf-p" className="text-xs">
                  Protein (g)
                </Label>
                <Input
                  id="qlf-p"
                  type="number"
                  min={0}
                  value={estimate.protein_g}
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
                  value={estimate.carbs_g}
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
                  value={estimate.fat_g}
                  onChange={(e) => patch("fat_g", e.target.value)}
                />
              </div>
            </div>

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
