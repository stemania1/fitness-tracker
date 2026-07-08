"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  buildVo2Trend,
  latestPullupMax,
  type FitnessTestEntry,
  type OuraVo2Sample,
} from "@/lib/fitness-tests"
import { classifyVo2Max, type Sex } from "@/lib/vo2max"
import { vo2MaxPercentile, percentileLabel } from "@/lib/vo2max-percentile"
import { QuickLogFitnessTest } from "./QuickLogFitnessTest"

const supabase = createClient()

const ratingBadge: Record<string, { label: string; className: string }> = {
  excellent: { label: "Excellent", className: "bg-emerald-100 text-emerald-700" },
  average: { label: "Average", className: "bg-blue-100 text-blue-700" },
  low: { label: "Room to improve", className: "bg-amber-100 text-amber-700" },
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

interface Vo2MaxTrendCardProps {
  age?: number | null
  sex?: Sex
}

export function Vo2MaxTrendCard({ age, sex }: Vo2MaxTrendCardProps) {
  const { data: tests, isLoading: testsLoading } = useQuery({
    queryKey: ["fitness-tests"],
    queryFn: async (): Promise<FitnessTestEntry[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("fitness_tests")
        .select("test_type, result, tested_at")
        .eq("user_id", user.id)
        .order("tested_at", { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: ouraSamples, isLoading: ouraLoading } = useQuery({
    queryKey: ["oura-vo2-history"],
    queryFn: async (): Promise<OuraVo2Sample[]> => {
      // 404 = Oura not connected; any failure just means no Oura series.
      const res = await fetch("/api/oura/vo2max")
      if (!res.ok) return []
      const body = (await res.json()) as {
        data?: Array<{ day: string; vo2_max: number | null }>
      }
      return (body.data ?? []).filter(
        (d): d is OuraVo2Sample => d.vo2_max != null
      )
    },
  })

  const trend = useMemo(
    () => buildVo2Trend(tests ?? [], ouraSamples ?? []),
    [tests, ouraSamples]
  )

  const pullupBest = useMemo(() => latestPullupMax(tests ?? []), [tests])

  const latestVo2 = useMemo(() => {
    for (let i = trend.length - 1; i >= 0; i--) {
      const value = trend[i].cooper ?? trend[i].oura
      if (value != null) return value
    }
    return null
  }, [trend])

  const rating = latestVo2 != null ? classifyVo2Max(latestVo2, age, sex) : null
  const percentile =
    latestVo2 != null ? vo2MaxPercentile(latestVo2, age, sex) : null

  const hasCooper = trend.some((p) => p.cooper != null)
  const hasOura = trend.some((p) => p.oura != null)
  const isLoading = testsLoading || ouraLoading

  const yDomain = useMemo((): [number, number] | undefined => {
    const values = trend.flatMap((p) =>
      [p.cooper, p.oura].filter((v): v is number => v != null)
    )
    if (!values.length) return undefined
    const min = Math.min(...values)
    const max = Math.max(...values)
    const padding = Math.max(2, Math.round((max - min) * 0.2))
    return [Math.floor(min - padding), Math.ceil(max + padding)]
  }, [trend])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-cyan-500" />
            VO2 Max Trend
          </CardTitle>
          <QuickLogFitnessTest />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : trend.length === 0 && !pullupBest ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <TrendingUp className="h-6 w-6 text-gray-300" />
            <p className="text-sm text-gray-500">
              No fitness tests logged yet.
            </p>
            <p className="text-xs text-gray-400">
              Log a Cooper 12-minute test to start your VO2 Max trend — Oura
              estimates will appear here automatically once your ring has one.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {latestVo2 != null && (
                <>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {latestVo2.toFixed(1)}
                      <span className="ml-1 text-xs font-normal text-gray-500">
                        ml/kg/min
                      </span>
                    </p>
                    {percentile != null && (
                      <p className="text-xs text-gray-500">
                        {percentileLabel(percentile)}{" "}
                        <span className="text-gray-400">· FRIEND</span>
                      </p>
                    )}
                  </div>
                  {rating && (
                    <Badge className={ratingBadge[rating].className}>
                      {ratingBadge[rating].label}
                    </Badge>
                  )}
                </>
              )}
              {pullupBest && (
                <p className="ml-auto text-sm text-gray-600">
                  Pull-up max:{" "}
                  <span className="font-semibold text-gray-900">
                    {pullupBest.reps}
                  </span>{" "}
                  <span className="text-xs text-gray-400">
                    ({formatDay(pullupBest.tested_at)})
                  </span>
                </p>
              )}
            </div>

            {trend.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trend}>
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
                    domain={yDomain}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    labelFormatter={(day) => formatDay(String(day))}
                    formatter={(value, name) => [
                      `${value} ml/kg/min`,
                      name === "cooper" ? "Cooper test" : "Oura estimate",
                    ]}
                  />
                  {(hasCooper || hasOura) && (
                    <Legend
                      formatter={(value) =>
                        value === "cooper" ? "Cooper test" : "Oura estimate"
                      }
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  )}
                  {hasOura && (
                    <Line
                      type="monotone"
                      dataKey="oura"
                      stroke="#14b8a6"
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                      activeDot={{ r: 3 }}
                    />
                  )}
                  {hasCooper && (
                    <Line
                      type="monotone"
                      dataKey="cooper"
                      stroke="#9333ea"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
