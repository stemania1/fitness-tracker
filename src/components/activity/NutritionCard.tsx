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
import { Utensils, Plus, Trash2, ChevronDown, Pencil, Scale } from "lucide-react"
import type { MacroTargets } from "@/lib/macro-targets"
import {
  classifyDailyGl,
  classifyMealGl,
  highImpactMealCount,
  GL_WALK_TIP,
} from "@/lib/glycemic-load"
import { localTimeValue, withLocalTime } from "@/lib/meal-time"
import {
  scaleMealNutrients,
  describePortion,
  PORTION_OPTIONS,
} from "@/lib/meal-portion"
import { DayNav } from "./DayNav"
import { dayLabel, dayWindow } from "@/lib/day-nav"
import { useSwipe } from "@/hooks/useSwipe"
import { getAuthUserId } from "@/lib/supabase/user-query"

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
  glycemic_load: number
  confidence: "low" | "medium" | "high" | null
  image_path: string | null
  logged_at: string
}

const confidenceBadge: Record<string, string> = {
  low: "bg-amber-100 text-amber-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-emerald-100 text-emerald-700",
}

/** Per-meal glucose-impact chip (only shown for medium/high). Labeled "GL"
 *  so it reads as glycemic load, distinct from the estimate-confidence badge. */
const glImpactBadge: Record<"medium" | "high", { cls: string; label: string }> = {
  medium: { cls: "bg-amber-100 text-amber-800", label: "Med GL" },
  high: { cls: "bg-red-100 text-red-700", label: "High GL" },
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
  // Swipe / arrows step through days: 0 = today, -1 = yesterday, … Meals only
  // exist in the past, so this looks back — forwards stops at today.
  const [offset, setOffset] = useState(0)
  const isToday = offset === 0
  const { startIso, endIso } = useMemo(() => dayWindow(offset), [offset])
  const queryClient = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)
  // Two-tap delete: first tap arms the row's trash button, second deletes.
  // Cheaper than a confirm dialog and still guards against stray taps.
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null)
  // Tap meal rows to expand their full stats (macros, sugar, time).
  // A set, not a single id — comparing two meals side by side is the point.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // Inline edit of a logged meal's time-of-day.
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null)
  const [timeDraft, setTimeDraft] = useState("")
  // Which meal is showing the portion-rescale chips.
  const [portionMealId, setPortionMealId] = useState<string | null>(null)

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const { data: logs, isLoading } = useQuery({
    // Prefix stays "food-logs-today" so existing invalidations (after logging
    // or editing a meal) still refresh this card whatever day it's showing.
    queryKey: ["food-logs-today", startIso],
    queryFn: async (): Promise<FoodLogRow[]> => {
      const userId = await getAuthUserId()
      const { data, error } = await supabase
        .from("food_logs")
        .select(
          "id, description, meal_type, calories, protein_g, carbs_g, fat_g, sugar_g, glycemic_load, confidence, image_path, logged_at"
        )
        .eq("user_id", userId)
        .gte("logged_at", startIso)
        .lt("logged_at", endIso)
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  // One-tap second serving: re-insert an identical food log with a fresh
  // timestamp, so you don't have to photograph the same food again.
  const logAgain = useMutation({
    mutationFn: async (meal: FoodLogRow) => {
      const userId = await getAuthUserId()
      const { error } = await supabase.from("food_logs").insert({
        user_id: userId,
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
        glycemic_load: meal.glycemic_load,
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
      const userId = await getAuthUserId()
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

  // Correct a meal's logged time-of-day in place (keeps its date, so it stays
  // on today's list). Meal timing feeds the energy read, so it's worth fixing.
  const updateMealTime = useMutation({
    mutationFn: async ({
      meal,
      loggedAt,
    }: {
      meal: FoodLogRow
      loggedAt: string
    }) => {
      const userId = await getAuthUserId()
      const { error } = await supabase
        .from("food_logs")
        .update({ logged_at: loggedAt })
        .eq("id", meal.id)
      if (error) throw error
    },
    onMutate: ({ meal }) => setPendingId(meal.id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs-today"] })
      queryClient.invalidateQueries({ queryKey: ["weekly-calories"] })
      setEditingTimeId(null)
    },
  })

  // Rescale a meal to the portion actually eaten. A photo estimate describes
  // the plate; eating half of it should halve the numbers, not need a re-log.
  const rescaleMeal = useMutation({
    mutationFn: async ({
      meal,
      factor,
    }: {
      meal: FoodLogRow
      factor: number
    }) => {
      const userId = await getAuthUserId()
      const { error } = await supabase
        .from("food_logs")
        .update({
          ...scaleMealNutrients(meal, factor),
          description: describePortion(meal.description, factor),
          edited: true,
        })
        .eq("id", meal.id)
      if (error) throw error
    },
    onMutate: ({ meal }) => setPendingId(meal.id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs-today"] })
      queryClient.invalidateQueries({ queryKey: ["weekly-calories"] })
      setPortionMealId(null)
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
        gl: acc.gl + (m.glycemic_load ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, gl: 0 }
    )
  }, [logs])

  // Calories-out (Oura) is only meaningful for today, so the net line hides
  // when browsing past days.
  const net =
    isToday && caloriesBurnedToday != null
      ? totals.calories - caloriesBurnedToday
      : null

  const swipe = useSwipe(
    () => !isToday && setOffset((o) => o + 1),
    () => setOffset((o) => o - 1)
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Utensils className="h-5 w-5 text-orange-500" />
          <DayNav
            label={`${dayLabel(offset)}'s Nutrition`}
            onPrev={() => setOffset((o) => o - 1)}
            onNext={isToday ? undefined : () => setOffset((o) => o + 1)}
          />
        </CardTitle>
      </CardHeader>
      <CardContent {...swipe}>
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (logs ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Utensils className="h-6 w-6 text-gray-300" />
            <p className="text-sm text-gray-500">
              {isToday
                ? "No meals logged today."
                : `Nothing logged for ${dayLabel(offset)}.`}
            </p>
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

            {/* Day-level glucose impact from summed glycemic load. A "today:
                low" total can hide a single high-impact meal, so when any meal
                ran high we call it out on its own line rather than burying it. */}
            {totals.gl > 0 && (() => {
              const dailyImpact = classifyDailyGl(totals.gl)
              const highCount = highImpactMealCount(
                (logs ?? []).map((m) => m.glycemic_load ?? 0)
              )
              return (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">
                    Glucose impact today:{" "}
                    <span
                      className={`font-semibold capitalize ${
                        dailyImpact === "high"
                          ? "text-red-600"
                          : dailyImpact === "medium"
                            ? "text-amber-600"
                            : "text-emerald-600"
                      }`}
                    >
                      {dailyImpact}
                    </span>{" "}
                    {highCount > 0 && dailyImpact !== "high" ? "so far " : ""}
                    (GL {totals.gl}).
                  </p>
                  {highCount > 0 && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span className="font-semibold">
                        {highCount} high-impact {highCount === 1 ? "meal" : "meals"}
                      </span>{" "}
                      today — a low daily total doesn&apos;t undo a big spike.{" "}
                      {GL_WALK_TIP}
                    </p>
                  )}
                </div>
              )
            })()}

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
                  className="rounded-lg border border-gray-100 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                  {/* Tapping the text toggles the full stats for this meal. */}
                  <button
                    onClick={() => toggleExpanded(m.id)}
                    aria-expanded={expandedIds.has(m.id)}
                    aria-label={`Show stats for ${m.description}`}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {m.description}
                      </p>
                      <p className="text-xs capitalize text-gray-400">
                        {m.meal_type}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-gray-300 transition-transform ${
                        expandedIds.has(m.id) ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {(() => {
                    const impact = classifyMealGl(m.glycemic_load ?? 0)
                    return impact !== "low" ? (
                      <Badge
                        className={`${glImpactBadge[impact].cls} shrink-0 text-[10px]`}
                        title={`Glucose impact: ${impact} (GL ${m.glycemic_load ?? 0})`}
                      >
                        {glImpactBadge[impact].label}
                      </Badge>
                    ) : null
                  })()}
                  {m.confidence && (
                    <Badge
                      className={`${confidenceBadge[m.confidence]} shrink-0 text-[10px]`}
                      title={`Estimate confidence: ${m.confidence}`}
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
                  </div>

                  {expandedIds.has(m.id) && (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      {/* The list row truncates long descriptions; show it
                          in full here alongside the numbers. */}
                      <p className="text-xs text-gray-600">{m.description}</p>
                      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                        {(
                          [
                            ["Cal", m.calories, "text-gray-900"],
                            ["Protein", `${m.protein_g}g`, "text-rose-700"],
                            ["Carbs", `${m.carbs_g}g`, "text-amber-700"],
                            ["Fat", `${m.fat_g}g`, "text-sky-700"],
                            ["Sugar", `${m.sugar_g ?? 0}g`, "text-fuchsia-700"],
                            [
                              "Glucose impact",
                              `${classifyMealGl(m.glycemic_load ?? 0)}`,
                              classifyMealGl(m.glycemic_load ?? 0) === "high"
                                ? "text-red-600 capitalize"
                                : classifyMealGl(m.glycemic_load ?? 0) ===
                                    "medium"
                                  ? "text-amber-600 capitalize"
                                  : "text-emerald-600 capitalize",
                            ],
                          ] as const
                        ).map(([label, value, cls]) => (
                          <div key={label} className="rounded-md bg-gray-50 py-1.5">
                            <p className={`text-sm font-semibold ${cls}`}>
                              {value}
                            </p>
                            <p className="text-[10px] text-gray-400">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                        {editingTimeId === m.id ? (
                          <>
                            <span>Logged at</span>
                            <input
                              type="time"
                              value={timeDraft}
                              onChange={(e) => setTimeDraft(e.target.value)}
                              aria-label={`Logged time for ${m.description}`}
                              className="rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <button
                              onClick={() =>
                                timeDraft &&
                                updateMealTime.mutate({
                                  meal: m,
                                  loggedAt: withLocalTime(m.logged_at, timeDraft),
                                })
                              }
                              disabled={pendingId === m.id || !timeDraft}
                              className="font-medium text-purple-600 hover:underline disabled:opacity-40"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingTimeId(null)}
                              className="text-gray-400 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span>
                              Logged at{" "}
                              {new Date(m.logged_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            <button
                              onClick={() => {
                                setEditingTimeId(m.id)
                                setTimeDraft(localTimeValue(m.logged_at))
                              }}
                              aria-label={`Edit logged time for ${m.description}`}
                              className="inline-flex items-center gap-0.5 text-purple-600 hover:underline"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                              Edit
                            </button>
                          </>
                        )}
                      </div>

                      {/* Ate more or less than the estimate assumed? Rescale
                          it rather than re-logging the meal. */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                        {portionMealId === m.id ? (
                          <>
                            <span>I ate</span>
                            {PORTION_OPTIONS.map((p) => (
                              <button
                                key={p.label}
                                onClick={() =>
                                  rescaleMeal.mutate({ meal: m, factor: p.factor })
                                }
                                disabled={pendingId === m.id}
                                aria-label={`Rescale ${m.description} to ${p.label}`}
                                className="rounded border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                              >
                                {p.label}
                              </button>
                            ))}
                            <button
                              onClick={() => setPortionMealId(null)}
                              className="text-gray-400 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setPortionMealId(m.id)}
                            aria-label={`Adjust portion for ${m.description}`}
                            className="inline-flex items-center gap-0.5 text-purple-600 hover:underline"
                          >
                            <Scale className="h-2.5 w-2.5" />
                            Adjust portion
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
