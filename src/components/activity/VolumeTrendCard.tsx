"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { buildWeeklyVolumeTrend, shouldSuggestDeload } from "@/lib/volume-trend"
import { useStrengthSets } from "@/hooks/useStrengthSets"
import { useUserQuery } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"

const supabase = createClient()

/**
 * Total weight lifted per week over the last 8, with a deload nudge when
 * volume has climbed steeply — especially if recovery is also running low.
 *
 * Unlike the dashboard (which had today's live Oura readiness on hand), this
 * standalone card reads the most recent stored readiness from oura_daily to
 * decide the low-recovery caveat.
 */
export function VolumeTrendCard() {
  const { data: allStrengthSets, isLoading: strengthSetsLoading } =
    useStrengthSets()

  const { data: latestReadiness } = useUserQuery(
    ["oura-latest-readiness"],
    async (userId: string): Promise<number | null> => {
      const { data, error } = await supabase
        .from("oura_daily")
        .select("readiness_score")
        .eq("user_id", userId)
        .not("readiness_score", "is", null)
        .order("day", { ascending: false })
        .limit(1)
      if (error) throw error
      return data?.[0]?.readiness_score ?? null
    },
    {
      retry: false,
    }
  )

  const volumeTrend = useMemo(
    () => buildWeeklyVolumeTrend(allStrengthSets ?? [], 8),
    [allStrengthSets]
  )

  const deloadSuggestion = useMemo(
    () =>
      shouldSuggestDeload(
        volumeTrend.map((v) => v.volume),
        latestReadiness ?? undefined
      ),
    [volumeTrend, latestReadiness]
  )

  return (
    <InsightCard
      icon={TrendingUp}
      accent="progress"
      title="Volume Trend"
      subtitle="Total weight lifted per week (last 8)"
    >
        {deloadSuggestion && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p className="font-medium">Consider a deload week</p>
        <p className="text-amber-700">
          Volume has climbed ~{deloadSuggestion.climbPercent}% over the last{" "}
          {deloadSuggestion.weeks} weeks
          {deloadSuggestion.lowReadiness &&
        " while your Oura readiness is running low"}
          . A lighter week now helps recovery and sets up the next push.
        </p>
          </div>
        )}
        {strengthSetsLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : volumeTrend.some((v) => v.volume > 0) ? (
          <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={volumeTrend}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="weekLabel"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
          }
        />
        <Tooltip
          formatter={(value) =>
            [
              typeof value === "number"
                ? `${value.toLocaleString()} lbs`
                : `${value}`,
              "Volume",
            ] as [string, string]
          }
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        />
        <Line
          type="monotone"
          dataKey="volume"
          stroke="#9333ea"
          strokeWidth={2}
          dot={{ r: 3, fill: "#9333ea" }}
          activeDot={{ r: 5 }}
        />
          </LineChart>
        </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-gray-500">
        Log a few strength workouts to see your volume trend.
          </div>
        )}
    </InsightCard>
  )
}
