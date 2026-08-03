"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Moon } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { daysAgoDateString } from "@/lib/dates"
import {
  buildOuraTrend,
  type OuraDailyPoint,
  type OuraMetric,
} from "@/lib/oura-trends"
import { useUserQuery } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"

const supabase = createClient()

const WINDOW_DAYS = 56

const METRICS: {
  key: OuraMetric
  tab: string
  label: string
  unit: string
  color: string
}[] = [
  { key: "sleepHours", tab: "Sleep", label: "Avg sleep", unit: "h", color: "#6366f1" },
  { key: "sleepScore", tab: "Score", label: "Avg sleep score", unit: "", color: "#0ea5e9" },
  { key: "readiness", tab: "Readiness", label: "Avg readiness", unit: "", color: "#10b981" },
]

function fmt(metric: OuraMetric, v: number): string {
  return metric === "sleepHours" ? `${v.toFixed(1)}h` : `${Math.round(v)}`
}

/** M/D from a YYYY-MM-DD day. */
function shortDay(day: string): string {
  const [, m, d] = day.split("-")
  return `${Number(m)}/${Number(d)}`
}

/**
 * Long-term sleep / readiness trends from stored Oura history, with a
 * week-over-week delta. Made possible by persisting oura_daily.
 */
export function SleepTrendCard() {
  const [metric, setMetric] = useState<OuraMetric>("sleepHours")

  const { data: rows, isLoading } = useUserQuery(
    ["oura-trend", WINDOW_DAYS],
    async (userId: string): Promise<OuraDailyPoint[]> => {
      const sinceStr = daysAgoDateString(WINDOW_DAYS)
      const { data, error } = await supabase
        .from("oura_daily")
        .select("day, sleep_score, sleep_minutes, readiness_score")
        .eq("user_id", userId)
        .gte("day", sinceStr)
      if (error) throw error
      return (data ?? []).map((r) => ({
        day: r.day,
        sleepScore: r.sleep_score,
        sleepMinutes: r.sleep_minutes,
        readinessScore: r.readiness_score,
      }))
    }
  )

  const cfg = METRICS.find((m) => m.key === metric)!
  const trend = useMemo(
    () => (rows ? buildOuraTrend(rows, metric) : null),
    [rows, metric]
  )

  return (
    <InsightCard
      icon={Moon}
      title="Sleep &amp; Recovery"
      action={
        <div className="flex gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              // min-h-11 is the 44px target the guide asks for. The chip keeps
              // its compact look — the box grows, the fill does not.
              className={`min-h-11 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                metric === m.key
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {m.tab}
            </button>
          ))}
        </div>
      }
    >
        {isLoading || !trend ? (
          <Skeleton className="h-40 w-full" />
        ) : trend.points.length < 3 ? (
          <p className="py-4 text-sm text-gray-500">
        Sleep and readiness trends will appear as your Oura history syncs —
        check back after a few nights.
          </p>
        ) : (
          <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-gray-900">
            {trend.avg7 != null ? fmt(metric, trend.avg7) : "—"}
          </p>
          <span className="text-xs text-gray-500">
            {cfg.label} (7-day)
          </span>
          {trend.delta != null && trend.delta !== 0 && (
            <span
              className={`ml-auto text-xs font-medium ${
                trend.delta > 0 ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {trend.delta > 0 ? "+" : ""}
              {fmt(metric, trend.delta)} vs last week
            </span>
          )}
        </div>

        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trend.points}
              margin={{ top: 5, right: 8, bottom: 0, left: -20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="day"
                tickFormatter={shortDay}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                domain={["auto", "auto"]}
                width={32}
              />
              <Tooltip
                formatter={(v) => [fmt(metric, Number(v)), cfg.label]}
                labelFormatter={(d) => shortDay(String(d))}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={cfg.color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
          </div>
        )}
    </InsightCard>
  )
}
