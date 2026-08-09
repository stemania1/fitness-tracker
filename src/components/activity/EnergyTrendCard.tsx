"use client"

import { useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { BatteryCharging } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  buildEnergyHistory,
  type EnergyHistoryDay,
} from "@/lib/energy-history"
import { localDateOf as localDate, formatShortDate } from "@/lib/dates"
import { useUserQuery } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"

const supabase = createClient()

const WINDOW_DAYS = 60

/**
 * How you said you felt against what the day's signals predicted.
 *
 * The check-in card answers this for today and then forgets it. The pattern
 * is what's actually informative: one rough morning is noise, but weeks of
 * feeling below what your sleep and recovery predict is a real signal, and
 * one that points outside anything the app measures.
 *
 * The expectation is recomputed from stored signals rather than read back —
 * `energy_checkins` never saved it — which is what lets this cover history
 * you've already logged instead of starting from empty today.
 */
export function EnergyTrendCard() {
  const { data, isLoading } = useUserQuery(
    ["energy-trend", WINDOW_DAYS],
    async (userId: string) => {
      const sinceIso = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
      const sinceDate = localDate(sinceIso)

      const [energyRes, workoutRes, ouraRes] = await Promise.all([
        supabase
          .from("energy_checkins")
          .select("level, logged_hour, logged_on, created_at")
          .eq("user_id", userId)
          .gte("logged_on", sinceDate)
          .order("created_at", { ascending: true }),
        supabase
          .from("workout_logs")
          .select("started_at")
          .eq("user_id", userId)
          .gte("started_at", sinceIso),
        supabase
          .from("oura_daily")
          .select("day, sleep_score, sleep_minutes, readiness_score")
          .eq("user_id", userId)
          .gte("day", sinceDate),
      ])
      if (energyRes.error) throw energyRes.error

      const trainedDays = new Set(
        (workoutRes.data ?? []).map((w) => localDate(w.started_at))
      )
      const ouraByDay = new Map(
        (ouraRes.data ?? []).map((o) => [o.day as string, o])
      )

      // One point per day. Re-picking how you feel inserts another row rather
      // than updating the first, so the latest check-in wins — the same rule
      // the dashboard uses for "how do you feel now".
      const latestByDay = new Map<string, (typeof energyRes.data)[number]>()
      for (const e of energyRes.data ?? []) latestByDay.set(e.logged_on, e)

      const days: EnergyHistoryDay[] = [...latestByDay.values()].map((e) => {
        const oura = ouraByDay.get(e.logged_on)
        return {
          day: e.logged_on,
          felt: e.level,
          hour: e.logged_hour ?? 12,
          signals: {
            sleepScore: oura?.sleep_score ?? null,
            sleepMinutes: oura?.sleep_minutes ?? null,
            readinessScore: oura?.readiness_score ?? null,
            trainedHardToday: trainedDays.has(e.logged_on),
          },
        }
      })

      return buildEnergyHistory(days)
    }
  )

  const chartData = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        ...p,
        label: formatShortDate(`${p.day}T12:00:00`),
      })),
    [data]
  )

  if (isLoading) {
    return (
      <InsightCard icon={BatteryCharging} title="Felt vs Expected">
        <Skeleton className="h-48 w-full" />
      </InsightCard>
    )
  }

  if (!data || data.points.length < 2) {
    return (
      <InsightCard icon={BatteryCharging} title="Felt vs Expected">
        <p className="text-sm text-gray-600">
          Two energy check-ins and this starts drawing. It compares how you
          said you felt with what your sleep, recovery and training predicted.
        </p>
      </InsightCard>
    )
  }

  return (
    <InsightCard
      icon={BatteryCharging}
      title="Felt vs Expected"
      action={
        <span className="text-xs text-gray-500">last {WINDOW_DAYS} days</span>
      }
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            {/* Pinned to the check-in scale: an auto domain would rescale the
                axis day to day and make identical gaps look different. */}
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="expected"
              name="Expected"
              stroke="#94a3b8"
              strokeDasharray="4 3"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="felt"
              name="Felt"
              stroke="#9333ea"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-gray-600">
        <span>
          <span className="font-semibold text-gray-900">{data.matchingDays}</span>{" "}
          tracking
        </span>
        <span>
          <span className="font-semibold text-gray-900">{data.aboveDays}</span>{" "}
          above
        </span>
        <span>
          <span className="font-semibold text-gray-900">{data.belowDays}</span>{" "}
          below
        </span>
      </div>

      {data.summary && (
        <p className="mt-2 text-sm text-gray-700">{data.summary}</p>
      )}

      {/* The expectation is rebuilt from stored signals, so a day whose ring
          data landed late reads differently here than it did on the day. */}
      <p className="mt-2 text-xs text-gray-400">
        Expected energy is recalculated from each day&apos;s sleep, recovery and
        training.
      </p>
    </InsightCard>
  )
}
