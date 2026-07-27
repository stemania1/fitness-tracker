"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkles, ArrowUpRight, ArrowDownRight } from "lucide-react"
import {
  analyzeEnergyDrivers,
  type DayObservation,
  type FactorSpec,
} from "@/lib/energy-correlations"
import { classifyMealGl } from "@/lib/glycemic-load"
import { shiftDate } from "@/lib/creatine-streak"

const supabase = createClient()

const WINDOW_DAYS = 60
/** Need at least this many days with an energy rating before we analyze. */
const MIN_DAYS = 10

/** Local YYYY-MM-DD for an ISO timestamp. */
function localDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const SPECS: FactorSpec[] = [
  { key: "sleepScore", kind: "numeric", whenHigh: "after better-scoring sleep" },
  { key: "sleepHours", kind: "numeric", whenHigh: "after more sleep" },
  { key: "readiness", kind: "numeric", whenHigh: "on higher-readiness days" },
  { key: "trained", kind: "boolean", whenHigh: "on days you train" },
  { key: "trainedYesterday", kind: "boolean", whenHigh: "the day after a workout" },
  { key: "creatine", kind: "boolean", whenHigh: "on days you take creatine" },
  { key: "caffeineMg", kind: "numeric", whenHigh: "on higher-caffeine days" },
  { key: "highGlMeals", kind: "numeric", whenHigh: "on higher-GL (sugar-spiking) meal days" },
  { key: "totalCals", kind: "numeric", whenHigh: "on higher-calorie days" },
]

/**
 * Personal energy-driver insights: mines your energy check-ins against the
 * things you log (training, caffeine, meals, creatine) and surfaces what
 * tracks with higher or lower energy. Sharpens as check-ins accumulate.
 */
export function EnergyDriversCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["energy-drivers", WINDOW_DAYS],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const sinceIso = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
      const sinceDate = localDate(sinceIso)

      const [energyRes, foodRes, caffRes, workoutRes, creatineRes, ouraRes] =
        await Promise.all([
          supabase
            .from("energy_checkins")
            .select("level, logged_on")
            .eq("user_id", user.id)
            .gte("logged_on", sinceDate),
          supabase
            .from("food_logs")
            .select("calories, glycemic_load, logged_at")
            .eq("user_id", user.id)
            .gte("logged_at", sinceIso),
          supabase
            .from("caffeine_logs")
            .select("mg, logged_at")
            .eq("user_id", user.id)
            .gte("logged_at", sinceIso),
          supabase
            .from("workout_logs")
            .select("started_at")
            .eq("user_id", user.id)
            .gte("started_at", sinceIso),
          supabase
            .from("creatine_logs")
            .select("taken_on")
            .eq("user_id", user.id)
            .gte("taken_on", sinceDate),
          supabase
            .from("oura_daily")
            .select("day, sleep_score, sleep_minutes, readiness_score")
            .eq("user_id", user.id)
            .gte("day", sinceDate),
        ])

      // Average energy per day.
      const energyByDay = new Map<string, { sum: number; n: number }>()
      for (const e of energyRes.data ?? []) {
        const cur = energyByDay.get(e.logged_on) ?? { sum: 0, n: 0 }
        cur.sum += e.level
        cur.n += 1
        energyByDay.set(e.logged_on, cur)
      }

      const calsByDay = new Map<string, number>()
      const highGlByDay = new Map<string, number>()
      for (const f of foodRes.data ?? []) {
        const d = localDate(f.logged_at)
        calsByDay.set(d, (calsByDay.get(d) ?? 0) + (f.calories ?? 0))
        if (classifyMealGl(f.glycemic_load ?? 0) === "high") {
          highGlByDay.set(d, (highGlByDay.get(d) ?? 0) + 1)
        }
      }

      const caffByDay = new Map<string, number>()
      for (const c of caffRes.data ?? []) {
        const d = localDate(c.logged_at)
        caffByDay.set(d, (caffByDay.get(d) ?? 0) + (c.mg ?? 0))
      }

      const trainedDays = new Set(
        (workoutRes.data ?? []).map((w) => localDate(w.started_at))
      )
      const creatineDays = new Set(
        (creatineRes.data ?? []).map((c) => c.taken_on as string)
      )

      const sleepScoreByDay = new Map<string, number>()
      const sleepHoursByDay = new Map<string, number>()
      const readinessByDay = new Map<string, number>()
      for (const o of ouraRes.data ?? []) {
        if (o.sleep_score != null) sleepScoreByDay.set(o.day, o.sleep_score)
        if (o.sleep_minutes != null)
          sleepHoursByDay.set(o.day, o.sleep_minutes / 60)
        if (o.readiness_score != null)
          readinessByDay.set(o.day, o.readiness_score)
      }

      const days: DayObservation[] = []
      for (const [date, agg] of energyByDay) {
        const foodLogged = calsByDay.has(date)
        days.push({
          energy: agg.sum / agg.n,
          factors: {
            sleepScore: sleepScoreByDay.get(date) ?? null,
            sleepHours: sleepHoursByDay.get(date) ?? null,
            readiness: readinessByDay.get(date) ?? null,
            trained: trainedDays.has(date),
            trainedYesterday: trainedDays.has(shiftDate(date, -1)),
            creatine: creatineDays.has(date),
            // Days with no caffeine logged count as 0 mg (a real signal).
            caffeineMg: caffByDay.get(date) ?? 0,
            // Meal factors only when meals were actually logged that day.
            highGlMeals: foodLogged ? highGlByDay.get(date) ?? 0 : null,
            totalCals: foodLogged ? calsByDay.get(date) ?? 0 : null,
          },
        })
      }
      return { days, energyDayCount: energyByDay.size }
    },
  })

  const insights = useMemo(
    () => (data ? analyzeEnergyDrivers(data.days, SPECS) : []),
    [data]
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-violet-500" />
          What moves your energy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-20 w-full" />
        ) : data.energyDayCount < MIN_DAYS ? (
          <p className="text-sm text-gray-500">
            Keep logging energy check-ins — I need about two weeks to spot your
            patterns.{" "}
            <span className="text-gray-400">
              {data.energyDayCount} day{data.energyDayCount === 1 ? "" : "s"} so
              far.
            </span>
          </p>
        ) : insights.length === 0 ? (
          <p className="text-sm text-gray-500">
            No strong patterns yet — keep logging and I&apos;ll surface what
            lifts or drains your energy.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {insights.map((ins) => (
              <li key={ins.key} className="flex items-start gap-2">
                {ins.direction === "higher" ? (
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                )}
                <p className="text-sm text-gray-700">{ins.message}</p>
              </li>
            ))}
            <li className="pt-1 text-[11px] text-gray-400">
              Patterns from your last {WINDOW_DAYS} days — associations, not
              proof.
            </li>
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
