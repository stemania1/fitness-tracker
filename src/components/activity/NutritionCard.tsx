"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Utensils, Plus, Trash2 } from "lucide-react"
import type { MacroTargets } from "@/lib/macro-targets"

const supabase = createClient()

interface FoodLogRow {
  id: string
  description: string
  meal_type: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sugar_g: number
  confidence: "low" | "medium" | "high" | null
  image_path: string | null
  logged_at: string
}

/** Local midnight ISO for the "today" query window. */
function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const confidenceBadge: Record<string, string> = {
  low: "bg-amber-100 text-amber-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-emerald-100 text-emerald-700",
}

interface NutritionCardProps {
  /** Today's calories-out (e.g. Oura total_calories), when available. */
  caloriesBurnedToday?: number | null
  /** Recommended daily targets from the profile (lib/macro-targets). */
  targets?: MacroTargets | null
}

export function NutritionCard({
  caloriesBurnedToday,
  targets,
}: NutritionCardProps = {}) {
  const dayStart = useMemo(() => startOfTodayIso(), [])
  const queryClient = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)
  // Two-tap delete: first tap arms the row's trash button, second deletes.
  // Cheaper than a confirm dialog and still guards against stray taps.
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null)

  const { data: logs, isLoading } = useQuery({
    queryKey: ["food-logs-today", dayStart],
    queryFn: async (): Promise<FoodLogRow[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("food_logs")
        .select(
          "id, description, meal_type, calories, protein_g, carbs_g, fat_g, sugar_g, confidence, image_path, logged_at"
        )
        .eq("user_id", user.id)
        .gte("logged_at", dayStart)
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  // One-tap second serving: re-insert an identical food log with a fresh
  // timestamp, so you don't have to photograph the same food again.
  const logAgain = useMutation({
    mutationFn: async (meal: FoodLogRow) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { error } = await supabase.from("food_logs").insert({
        user_id: user.id,
        description: meal.description,
        // Value comes straight from a stored row, so it's a valid meal_type.
        meal_type: meal.meal_type as
          | "breakfast"
          | "lunch"
          | "dinner"
          | "snack"
          | "meal",
        calories: meal.calories,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
        sugar_g: meal.sugar_g,
        image_path: meal.image_path,
        confidence: meal.confidence,
        edited: false,
      })
      if (error) throw error
    },
    onMutate: (meal) => setPendingId(meal.id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs-today"] })
      queryClient.invalidateQueries({ queryKey: ["weekly-calories"] })
    },
  })

  const deleteMeal = useMutation({
    mutationFn: async (meal: FoodLogRow) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { error } = await supabase
        .from("food_logs")
        .delete()
        .eq("id", meal.id)
      if (error) throw error
      // Photo cleanup is best-effort — the log row is already gone, and an
      // orphaned image is not worth failing the delete over.
      if (meal.image_path) {
        await supabase.storage.from("meal-photos").remove([meal.image_path])
      }
    },
    onMutate: (meal) => setPendingId(meal.id),
    onSettled: () => {
      setPendingId(null)
      setArmedDeleteId(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs-today"] })
      queryClient.invalidateQueries({ queryKey: ["weekly-calories"] })
    },
  })

  const totals = useMemo(() => {
    const meals = logs ?? []
    return meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein_g,
        carbs: acc.carbs + m.carbs_g,
        fat: acc.fat + m.fat_g,
        sugar: acc.sugar + (m.sugar_g ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0 }
    )
  }, [logs])

  const net =
    caloriesBurnedToday != null
      ? totals.calories - caloriesBurnedToday
      : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Utensils className="h-5 w-5 text-orange-500" />
          Today&apos;s Nutrition
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (logs ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Utensils className="h-6 w-6 text-gray-300" />
            <p className="text-sm text-gray-500">No meals logged today.</p>
            <p className="text-xs text-gray-400">
              Tap <span className="font-medium">Snap Meal</span> above to
              photograph a meal and log its calories.
            </p>
            {targets && (
              <p className="text-xs text-gray-400">
                Today&apos;s targets: {targets.calories.toLocaleString()} cal ·{" "}
                {targets.protein_g}g protein · {targets.carbs_g}g carbs ·{" "}
                {targets.fat_g}g fat
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <p className="text-2xl font-bold text-gray-900">
                {totals.calories.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-gray-500">
                  cal in
                  {targets && ` · of ${targets.calories.toLocaleString()}`}
                </span>
              </p>
              {net != null && (
                <p className="ml-auto text-sm text-gray-600">
                  Net{" "}
                  <span
                    className={`font-semibold ${net > 0 ? "text-orange-600" : "text-emerald-600"}`}
                  >
                    {net > 0 ? "+" : ""}
                    {net.toLocaleString()}
                  </span>{" "}
                  <span className="text-xs text-gray-400">
                    vs {caloriesBurnedToday?.toLocaleString()} out
                  </span>
                </p>
              )}
            </div>

            {targets && (
              <div
                className="h-1.5 overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-label="Calories vs daily target"
                aria-valuenow={totals.calories}
                aria-valuemax={targets.calories}
              >
                <div
                  className={`h-full rounded-full ${
                    totals.calories > targets.calories
                      ? "bg-orange-400"
                      : "bg-purple-500"
                  }`}
                  style={{
                    width: `${Math.min(100, (totals.calories / targets.calories) * 100)}%`,
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ["Protein", totals.protein, targets?.protein_g, "bg-rose-50 text-rose-700", "bg-rose-400"],
                  ["Carbs", totals.carbs, targets?.carbs_g, "bg-amber-50 text-amber-700", "bg-amber-400"],
                  ["Fat", totals.fat, targets?.fat_g, "bg-sky-50 text-sky-700", "bg-sky-400"],
                ] as const
              ).map(([label, grams, target, cls, barCls]) => (
                <div key={label} className={`rounded-lg p-2 ${cls}`}>
                  <p className="text-lg font-bold">
                    {grams}g
                    {target != null && (
                      <span className="text-xs font-normal opacity-70">
                        {" "}
                        / {target}g
                      </span>
                    )}
                  </p>
                  <p className="text-xs">{label}</p>
                  {target != null && (
                    <div
                      className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/70"
                      role="progressbar"
                      aria-label={`${label} vs daily target`}
                      aria-valuenow={grams}
                      aria-valuemax={target}
                    >
                      <div
                        className={`h-full rounded-full ${barCls}`}
                        style={{
                          width: `${Math.min(100, (grams / target) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sugar is a ceiling, not a target — shown as its own slim row
                so it doesn't read like a macro to hit. */}
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                targets && totals.sugar > targets.sugar_limit_g
                  ? "bg-red-50 text-red-700"
                  : "bg-fuchsia-50 text-fuchsia-700"
              }`}
            >
              <p className="text-sm font-bold">{totals.sugar}g</p>
              <p className="text-xs">
                Sugar
                {targets && ` · aim under ${targets.sugar_limit_g}g`}
              </p>
              {targets && (
                <div
                  className="ml-auto h-1 w-24 overflow-hidden rounded-full bg-white/70"
                  role="progressbar"
                  aria-label="Sugar vs daily limit"
                  aria-valuenow={totals.sugar}
                  aria-valuemax={targets.sugar_limit_g}
                >
                  <div
                    className={`h-full rounded-full ${
                      totals.sugar > targets.sugar_limit_g
                        ? "bg-red-400"
                        : "bg-fuchsia-400"
                    }`}
                    style={{
                      width: `${Math.min(100, (totals.sugar / targets.sugar_limit_g) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {targets && (
              <p className="text-xs text-gray-400">
                Targets estimated from your height, weight, age, and activity —{" "}
                {targets.goalNote}.
              </p>
            )}

            <ul className="space-y-1.5">
              {(logs ?? []).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {m.description}
                    </p>
                    <p className="text-xs capitalize text-gray-400">
                      {m.meal_type}
                    </p>
                  </div>
                  {m.confidence && (
                    <Badge
                      className={`${confidenceBadge[m.confidence]} shrink-0 text-[10px]`}
                    >
                      {m.confidence}
                    </Badge>
                  )}
                  <span className="shrink-0 text-sm font-semibold text-gray-900">
                    {m.calories.toLocaleString()}
                  </span>
                  <button
                    onClick={() => logAgain.mutate(m)}
                    disabled={pendingId === m.id}
                    className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-purple-50 hover:text-purple-600 disabled:opacity-40"
                    title="Log another serving"
                    aria-label={`Log another serving of ${m.description}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      armedDeleteId === m.id
                        ? deleteMeal.mutate(m)
                        : setArmedDeleteId(m.id)
                    }
                    disabled={pendingId === m.id}
                    className={`shrink-0 rounded-md p-1 transition-colors disabled:opacity-40 ${
                      armedDeleteId === m.id
                        ? "bg-red-50 text-red-600"
                        : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                    }`}
                    title={
                      armedDeleteId === m.id
                        ? "Tap again to delete"
                        : "Delete this entry"
                    }
                    aria-label={
                      armedDeleteId === m.id
                        ? `Confirm delete of ${m.description}`
                        : `Delete ${m.description}`
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
