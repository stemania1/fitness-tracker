"use client"

import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Scale } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { formatShortDate } from "@/lib/dates"

const supabase = createClient()

/**
 * Weight over the last 30 logged entries against the target-weight goal line.
 * Falls back to a current-vs-target readout until there are at least two
 * points to draw a line.
 */
export function WeightTrendCard() {
  const { data: weightLogs, isLoading: weightLoading } = useQuery({
    queryKey: ["weight-logs-recent"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("weight_logs")
        .select("weight, logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: true })
        .limit(30)
      if (error) throw error
      return data ?? []
    },
  })

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["weight-target-profile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data } = await supabase
        .from("user_profiles")
        .select("target_weight, current_weight")
        .eq("id", user.id)
        .single()
      return data
    },
  })

  const latestWeight = weightLogs?.length
    ? weightLogs[weightLogs.length - 1]
    : null

  const weightChartData = useMemo(
    () =>
      (weightLogs ?? []).map((w) => ({
        date: formatShortDate(w.logged_at),
        weight: w.weight,
      })),
    [weightLogs]
  )

  const weightDomain = useMemo(() => {
    const weights = (weightLogs ?? []).map((w) => w.weight)
    const target = profile?.target_weight
    if (target) weights.push(target)
    if (weights.length === 0) return undefined
    const min = Math.min(...weights)
    const max = Math.max(...weights)
    const padding = Math.max(3, Math.round((max - min) * 0.15))
    return [Math.floor(min - padding), Math.ceil(max + padding)]
  }, [weightLogs, profile?.target_weight])

  const CustomTooltip = useCallback(
    ({
      active,
      payload,
    }: {
      active?: boolean
      payload?: Array<{ value: number }>
    }) => {
      if (!active || !payload?.length) return null
      return (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm">
          <span className="font-semibold text-gray-900">
            {payload[0].value}
          </span>{" "}
          <span className="text-gray-500">lbs</span>
        </div>
      )
    },
    []
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-5 w-5 text-blue-500" />
            Weight Trend
          </CardTitle>
          {!weightLoading && latestWeight && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-gray-900">
                {latestWeight.weight}
              </span>
              <span className="text-xs text-gray-500">lbs</span>
              {profile?.target_weight && (
                <span className="text-xs text-gray-400">
                  / {profile.target_weight}
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {weightLoading || profileLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : weightChartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weightChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                domain={weightDomain}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              {profile?.target_weight && (
                <ReferenceLine
                  y={profile.target_weight}
                  stroke="#22c55e"
                  strokeDasharray="6 3"
                  label={{
                    value: "Goal",
                    position: "right",
                    fontSize: 11,
                    fill: "#22c55e",
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={{ r: 3, fill: "#7c3aed" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {latestWeight?.weight ?? profile?.current_weight ?? "--"}
              </p>
              <p className="text-xs text-gray-500">Current (lbs)</p>
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {profile?.target_weight ?? "--"}
              </p>
              <p className="text-xs text-gray-500">Target (lbs)</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
