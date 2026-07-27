"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react"
import {
  estimateAdaptiveTdee,
  recommendedRate,
  targetIntakeForRate,
  type DailyIntake,
  type TdeeConfidence,
} from "@/lib/adaptive-tdee"
import type { WeightPoint } from "@/lib/weight-projection"

const supabase = createClient()

const WINDOW_DAYS = 70

/** Local-day index (days since epoch), shared basis for weigh-ins and intake. */
function epochDay(iso: string): number {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 86_400_000)
}

const confidenceStyle: Record<Exclude<TdeeConfidence, "insufficient">, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-emerald-100 text-emerald-700",
}

/**
 * Adaptive energy-balance card: learns maintenance calories from the weight
 * trend vs logged intake and recommends a daily target to reach the weight
 * goal. Pairs with the Nutrition card (calories in) — this is the "and how
 * many should I eat?" answer, self-correcting as data accrues.
 */
export function EnergyBalanceCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["energy-balance", WINDOW_DAYS],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const sinceIso = new Date(
        Date.now() - WINDOW_DAYS * 86_400_000
      ).toISOString()

      const [profileRes, weightRes, foodRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("current_weight, target_weight")
          .eq("id", user.id)
          .single(),
        supabase
          .from("weight_logs")
          .select("weight, logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", sinceIso),
        supabase
          .from("food_logs")
          .select("calories, logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", sinceIso),
      ])

      const weighIns: WeightPoint[] = (weightRes.data ?? []).map((w) => ({
        day: epochDay(w.logged_at),
        weight: w.weight,
      }))

      // Sum calories per local day.
      const byDay = new Map<number, number>()
      for (const f of foodRes.data ?? []) {
        const d = epochDay(f.logged_at)
        byDay.set(d, (byDay.get(d) ?? 0) + (f.calories ?? 0))
      }
      const intake: DailyIntake[] = [...byDay.entries()].map(([day, calories]) => ({
        day,
        calories,
      }))

      return {
        currentWeight: profileRes.data?.current_weight ?? null,
        targetWeight: profileRes.data?.target_weight ?? null,
        weighIns,
        intake,
      }
    },
  })

  const view = useMemo(() => {
    if (!data) return null
    const est = estimateAdaptiveTdee(data.weighIns, data.intake)
    const rate =
      data.currentWeight != null
        ? recommendedRate(data.currentWeight, data.targetWeight)
        : 0
    const target =
      est.tdee != null ? targetIntakeForRate(est.tdee, rate) : null
    return { est, rate, target }
  }, [data])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-5 w-5 text-teal-600" />
          Energy Balance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !view ? (
          <Skeleton className="h-24 w-full" />
        ) : view.est.tdee == null ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Learning your metabolism from your weight trend and meals.
            </p>
            <p className="text-xs text-gray-400">
              {view.est.weighInCount} weigh-in
              {view.est.weighInCount === 1 ? "" : "s"} ·{" "}
              {view.est.intakeDayCount} day
              {view.est.intakeDayCount === 1 ? "" : "s"} of meals logged. Keep
              logging both — about 2–3 weeks unlocks a maintenance estimate.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-2xl font-bold text-gray-900">
                ~{view.est.tdee.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-gray-500">
                  cal/day maintenance
                </span>
              </p>
              <Badge
                className={confidenceStyle[view.est.confidence as Exclude<TdeeConfidence, "insufficient">]}
              >
                {view.est.confidence} confidence
              </Badge>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              {view.est.lbsPerWeek == null || view.est.lbsPerWeek === 0 ? (
                <>
                  <Minus className="h-4 w-4 text-gray-400" />
                  Holding steady
                </>
              ) : view.est.lbsPerWeek < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-emerald-500" />
                  Losing {Math.abs(view.est.lbsPerWeek)} lb/week
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  Gaining {view.est.lbsPerWeek} lb/week
                </>
              )}
            </div>

            {view.target != null && view.rate !== 0 && (
              <div className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
                <span className="font-semibold">
                  Aim for ~{view.target.toLocaleString()} cal/day
                </span>{" "}
                to {view.rate < 0 ? "lose" : "gain"} about{" "}
                {Math.abs(view.rate)} lb/week toward your goal.
              </div>
            )}
            {view.rate === 0 && (
              <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
                You&apos;re at your goal weight — about{" "}
                <span className="font-semibold">
                  {view.est.tdee.toLocaleString()} cal/day
                </span>{" "}
                holds it.
              </p>
            )}

            <p className="text-[11px] text-gray-400">
              Learned from your actual weight trend vs. logged calories, and
              re-tuned as you log more.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
