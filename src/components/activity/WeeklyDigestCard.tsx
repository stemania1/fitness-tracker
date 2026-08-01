"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { ClipboardList, Dumbbell, Scale, Sparkles, Target } from "lucide-react"
import {
  estimateAdaptiveTdee,
  recommendedRate,
  targetIntakeForRate,
  type DailyIntake,
} from "@/lib/adaptive-tdee"
import type { WeightPoint } from "@/lib/weight-projection"
import { buildOuraTrend, type OuraDailyPoint } from "@/lib/oura-trends"
import { epochDay, localDateString } from "@/lib/dates"
import {
  buildWeeklyDigest,
  type DigestInput,
  type Tone,
} from "@/lib/weekly-digest"
import { useUserQuery } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"

const supabase = createClient()

const DAY = 86_400_000

const toneDot: Record<Tone, string> = {
  good: "bg-emerald-500",
  neutral: "bg-gray-300",
  warn: "bg-amber-500",
}
const iconFor = { fitness: Dumbbell, weight: Scale, energy: Sparkles }

/**
 * Weekly coach digest — one readout across all three goals (fitness, weight,
 * energy) plus the 1–2 highest-impact actions for the week ahead, assembled
 * from the same signals the individual cards use.
 */
export function WeeklyDigestCard() {
  const { data, isLoading } = useUserQuery(
    ["weekly-digest"],
    async (userId: string): Promise<DigestInput> => {

      const now = Date.now()
      const since70Iso = new Date(now - 70 * DAY).toISOString()
      const since21Iso = new Date(now - 21 * DAY).toISOString()
      const d7 = localDateString(new Date(now - 7 * DAY))
      const d14 = localDateString(new Date(now - 14 * DAY))

      const [profileRes, weightRes, foodRes, workoutRes, energyRes, ouraRes] =
        await Promise.all([
          supabase
            .from("user_profiles")
            .select("current_weight, target_weight")
            .eq("id", userId)
            .single(),
          supabase
            .from("weight_logs")
            .select("weight, logged_at")
            .eq("user_id", userId)
            .gte("logged_at", since70Iso),
          supabase
            .from("food_logs")
            .select("calories, logged_at")
            .eq("user_id", userId)
            .gte("logged_at", since70Iso),
          supabase
            .from("workout_logs")
            .select("started_at")
            .eq("user_id", userId)
            .gte("started_at", since21Iso),
          supabase
            .from("energy_checkins")
            .select("level, logged_on")
            .eq("user_id", userId)
            .gte("logged_on", d14),
          supabase
            .from("oura_daily")
            .select("day, sleep_score, sleep_minutes, readiness_score")
            .eq("user_id", userId)
            .gte("day", localDateString(new Date(now - 21 * DAY))),
        ])

      // Workouts — this week (last 7d) vs the 7 before.
      const wThisStart = now - 7 * DAY
      const wLastStart = now - 14 * DAY
      let workoutsThisWeek = 0
      let workoutsLastWeek = 0
      for (const w of workoutRes.data ?? []) {
        const t = new Date(w.started_at).getTime()
        if (t >= wThisStart) workoutsThisWeek++
        else if (t >= wLastStart) workoutsLastWeek++
      }

      // Adaptive TDEE.
      const weighIns: WeightPoint[] = (weightRes.data ?? []).map((w) => ({
        day: epochDay(w.logged_at),
        weight: w.weight,
      }))
      const byDay = new Map<number, number>()
      for (const f of foodRes.data ?? []) {
        const d = epochDay(f.logged_at)
        byDay.set(d, (byDay.get(d) ?? 0) + (f.calories ?? 0))
      }
      const intake: DailyIntake[] = [...byDay.entries()].map(([day, calories]) => ({
        day,
        calories,
      }))
      const est = estimateAdaptiveTdee(weighIns, intake)
      const current = profileRes.data?.current_weight ?? null
      const targetRate =
        current != null
          ? recommendedRate(current, profileRes.data?.target_weight ?? null)
          : 0
      const targetIntake =
        est.tdee != null ? targetIntakeForRate(est.tdee, targetRate) : null

      // Energy this week vs last.
      const eThis: number[] = []
      const eLast: number[] = []
      for (const e of energyRes.data ?? []) {
        if (e.logged_on >= d7) eThis.push(e.level)
        else if (e.logged_on >= d14) eLast.push(e.level)
      }
      const avg = (xs: number[]) =>
        xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null

      // Sleep.
      const ouraPoints: OuraDailyPoint[] = (ouraRes.data ?? []).map((r) => ({
        day: r.day,
        sleepScore: r.sleep_score,
        sleepMinutes: r.sleep_minutes,
        readinessScore: r.readiness_score,
      }))
      const sleepTrend = buildOuraTrend(ouraPoints, "sleepHours")

      return {
        workoutsThisWeek,
        workoutsLastWeek,
        tdee: est.tdee,
        weightTrendLbsPerWeek: est.lbsPerWeek,
        targetRateLbsPerWeek: targetRate,
        avgIntake: est.avgIntake,
        targetIntake,
        avgEnergyThisWeek: avg(eThis),
        avgEnergyLastWeek: avg(eLast),
        avgSleepHours: sleepTrend.avg7,
        sleepDeltaHours: sleepTrend.delta,
        topEnergyInsight: null,
      }
    }
  )

  const digest = useMemo(() => (data ? buildWeeklyDigest(data) : null), [data])

  return (
    <InsightCard
      icon={ClipboardList}
      accent="progress"
      title="Weekly Check-In"
    >
        {isLoading || !digest ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4">
        <div className="space-y-2.5">
          {digest.sections.map((s) => {
        const Icon = iconFor[s.key]
        return (
          <div key={s.key} className="flex items-start gap-2.5">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[s.tone]}`}
            />
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {s.headline}
              </p>
              {s.detail && (
                <p className="text-xs text-gray-500">{s.detail}</p>
              )}
            </div>
          </div>
        )
          })}
        </div>

        <div className="rounded-lg bg-purple-50 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700">
        <Target className="h-3.5 w-3.5" />
        This week&apos;s focus
          </p>
          <ul className="space-y-1.5">
        {digest.actions.map((a, idx) => (
          <li key={idx} className="text-sm text-purple-900">
            {a.text}
          </li>
        ))}
          </ul>
        </div>
          </div>
        )}
    </InsightCard>
  )
}
