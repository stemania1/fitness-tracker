"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Moon } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  correlateDrivers,
  describeCorrelation,
  type DailyMetrics,
  type CorrelationStrength,
} from "@/lib/sleep-insights"

const WINDOWS = [30, 60, 90] as const

const strengthBadge: Record<
  CorrelationStrength,
  { label: string; className: string }
> = {
  strong: { label: "Strong", className: "bg-purple-100 text-purple-700" },
  moderate: { label: "Moderate", className: "bg-blue-100 text-blue-700" },
  weak: { label: "Weak", className: "bg-slate-100 text-slate-600" },
  none: { label: "No link", className: "bg-gray-100 text-gray-500" },
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function RemInsightsCard() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(60)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["oura-metrics", days],
    queryFn: async (): Promise<DailyMetrics[]> => {
      const res = await fetch(`/api/oura/metrics?days=${days}`)
      if (res.status === 404) return [] // Oura not connected
      if (!res.ok) throw new Error("Failed to load Oura metrics")
      const body = (await res.json()) as { data?: DailyMetrics[] }
      return body.data ?? []
    },
  })

  const metrics = data ?? []

  const remNights = useMemo(
    () => metrics.filter((m) => m.remFraction != null),
    [metrics]
  )

  const correlations = useMemo(() => correlateDrivers(metrics), [metrics])

  const chartData = useMemo(
    () =>
      remNights.map((m) => ({
        day: m.day,
        rem: m.remMinutes,
        remPct:
          m.remFraction != null ? Math.round(m.remFraction * 100) : null,
      })),
    [remNights]
  )

  const avgRemPct = useMemo(() => {
    const vals = remNights
      .map((m) => m.remFraction)
      .filter((v): v is number => v != null)
    if (!vals.length) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100)
  }, [remNights])

  // Rank correlations by strength for display: strongest signal first.
  const rankedCorrelations = useMemo(
    () =>
      [...correlations].sort(
        (a, b) => (b.r == null ? 0 : Math.abs(b.r)) - (a.r == null ? 0 : Math.abs(a.r))
      ),
    [correlations]
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="h-5 w-5 text-indigo-500" />
            REM &amp; Sleep Insights
          </CardTitle>
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setDays(w)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  days === w
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Moon className="h-6 w-6 text-gray-300" />
            <p className="text-sm text-gray-500">
              Unable to load Oura sleep data right now.
            </p>
          </div>
        ) : remNights.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Moon className="h-6 w-6 text-gray-300" />
            <p className="text-sm text-gray-500">
              No Oura sleep history yet.
            </p>
            <p className="text-xs text-gray-400">
              Connect your Oura Ring on the Profile page — REM trends and
              correlations appear once a few nights have synced.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              {avgRemPct != null && (
                <p className="text-2xl font-bold text-gray-900">
                  {`${avgRemPct}%`}
                  <span className="ml-1 text-xs font-normal text-gray-500">
                    avg REM · {remNights.length} nights
                  </span>
                </p>
              )}
            </div>

            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatDay}
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                  width={32}
                  unit="m"
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelFormatter={(day) => formatDay(String(day))}
                  formatter={(value, _name, item) => [
                    `${value} min (${item?.payload?.remPct ?? "?"}%)`,
                    "REM",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="rem"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>

            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">
                What tracks with your REM?
              </p>
              {rankedCorrelations.map((c) => (
                <div
                  key={c.key}
                  className="rounded-lg border border-gray-100 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {c.label}
                    </span>
                    <Badge className={strengthBadge[c.strength].className}>
                      {c.r != null && c.strength !== "none"
                        ? `${strengthBadge[c.strength].label} ${c.direction === "positive" ? "↑" : "↓"}`
                        : strengthBadge[c.strength].label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {describeCorrelation(c)}
                  </p>
                </div>
              ))}
            </div>

            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Exploratory only — these are associations across {remNights.length}{" "}
              nights, not proof of cause. Alcohol, late meals, and screen time
              aren&apos;t measured. REM is compared as a % of sleep, so
              &ldquo;total sleep&rdquo; reflects quality, not just duration.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
