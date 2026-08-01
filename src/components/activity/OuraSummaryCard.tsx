"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Activity,
  Moon,
  Heart,
  Zap,
  Flame,
  Wind,
  Brain,
  Shield,
  TrendingUp,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts"
import type { OuraSummary } from "@/lib/oura"
import { formatSleepDuration } from "@/lib/oura"
import { zoneRange, classifyHeartRate } from "@/lib/heart-rate"
import { RingBatteryIndicator } from "@/components/activity/RingBatteryIndicator"
import { localToday } from "@/lib/dates"
import { useProfile } from "@/hooks/useProfile"
import { InsightCard } from "@/components/ui/insight-card"

const supabase = createClient()

/**
 * Today's Oura snapshot: sleep, readiness, activity, HR, SpO2, stress,
 * resilience, VO2 max, and an intraday heart-rate timeline with the user's
 * Zone 2-3 band. A daily-glance card, so it stays on the dashboard — but
 * self-fetching. It shares the ["oura-summary"] query key with the dashboard,
 * so the fetch happens once and other cards read the same cache. Renders
 * nothing until the ring is connected and the summary has loaded.
 */
export function OuraSummaryCard() {
  const { data: ouraResult, isLoading: ouraLoading } = useQuery<{
    connected: boolean
    summary: OuraSummary | null
    error?: string
  }>({
    queryKey: ["oura-summary"],
    queryFn: async () => {
      const localDate = localToday()
      const offsetMin = new Date().getTimezoneOffset() // e.g. 240 for EDT (UTC-4)
      const sign = offsetMin <= 0 ? "+" : "-"
      const absMin = Math.abs(offsetMin)
      const tzOffset = `${sign}${String(Math.floor(absMin / 60)).padStart(2, "0")}:${String(absMin % 60).padStart(2, "0")}`
      const res = await fetch(
        `/api/oura?date=${localDate}&tz_offset=${encodeURIComponent(tzOffset)}`
      )
      if (res.status === 404) return { connected: false, summary: null }
      if (res.status === 401)
        return { connected: true, summary: null, error: "token_expired" }
      if (!res.ok) return { connected: true, summary: null, error: "fetch_failed" }
      const summary = (await res.json()) as OuraSummary
      return { connected: true, summary }
    },
    retry: false,
  })

  const { data: profile } = useProfile()
  const age = profile?.age ?? null

  const ouraSummary = ouraResult?.summary ?? null
  const ouraConnected = ouraResult?.connected ?? false

  // Zone 2-3 band for the heart-rate chart (moderate-effort target).
  const moderateZone = useMemo(() => zoneRange(age ?? null, 2, 3), [age])

  if (ouraLoading || !ouraConnected) return null

  return (
    <InsightCard
      icon={Activity}
      title="Today&apos;s Oura Summary"
      action={
        <RingBatteryIndicator battery={ouraSummary?.ringBattery ?? null} />
      }
    >
        {ouraResult?.error === "token_expired" ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Heart className="h-6 w-6 text-red-300" />
        <p className="text-sm text-gray-500">
          Your Oura Ring session has expired.
        </p>
        <p className="text-xs text-gray-400">
          Go to <a href="/profile" className="text-purple-600 underline hover:text-purple-700">Profile</a> to reconnect your ring.
        </p>
          </div>
        ) : ouraResult?.error ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Activity className="h-6 w-6 text-gray-300" />
        <p className="text-sm text-gray-500">
          Unable to fetch Oura data right now.
        </p>
        <p className="text-xs text-gray-400">
          This is usually temporary — try refreshing the page.
        </p>
          </div>
        ) : ouraSummary && (ouraSummary.sleep || ouraSummary.sleepPeriod || ouraSummary.activity || ouraSummary.readiness || ouraSummary.restingHeartRate || ouraSummary.spo2 || ouraSummary.stress || ouraSummary.resilience || ouraSummary.vo2Max) ? (
          <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Sleep */}
          {(ouraSummary.sleep || ouraSummary.sleepPeriod) && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Moon className="h-3.5 w-3.5" />
                Sleep
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {ouraSummary.sleep?.score ?? "--"}
              </p>
              <p className="text-xs text-gray-500">
                {ouraSummary.sleepPeriod?.total_sleep_duration
                  ? formatSleepDuration(ouraSummary.sleepPeriod.total_sleep_duration)
                  : "No duration data"}
              </p>
              {ouraSummary.sleepPeriod && (
                <p className="mt-0.5 text-xs text-gray-400">
                  {ouraSummary.sleepPeriod.average_hrv != null && `HRV ${ouraSummary.sleepPeriod.average_hrv}ms`}
                  {ouraSummary.sleepPeriod.average_hrv != null && ouraSummary.sleepPeriod.lowest_heart_rate != null && " · "}
                  {ouraSummary.sleepPeriod.lowest_heart_rate != null && `Low HR ${ouraSummary.sleepPeriod.lowest_heart_rate}`}
                </p>
              )}
            </div>
          )}

          {/* Readiness */}
          {ouraSummary.readiness && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Zap className="h-3.5 w-3.5" />
                Readiness
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {ouraSummary.readiness.score ?? "--"}
              </p>
              <p className="text-xs text-gray-500">Recovery score</p>
              {ouraSummary.readiness.temperature_deviation != null && (
                <p className="mt-0.5 text-xs text-gray-400">
                  Temp {ouraSummary.readiness.temperature_deviation > 0 ? "+" : ""}
                  {ouraSummary.readiness.temperature_deviation.toFixed(1)}°
                </p>
              )}
            </div>
          )}

          {/* Activity */}
          {ouraSummary.activity && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Flame className="h-3.5 w-3.5" />
                Activity
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {ouraSummary.activity.active_calories?.toLocaleString() ?? "--"}
              </p>
              <p className="text-xs text-gray-500">
                Active cal &middot; {ouraSummary.activity.steps?.toLocaleString() ?? 0} steps
              </p>
            </div>
          )}

          {/* Heart Rate */}
          {ouraSummary.restingHeartRate && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Heart className="h-3.5 w-3.5" />
                Avg Heart Rate
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {ouraSummary.restingHeartRate}
              </p>
              <p className="text-xs text-gray-500">bpm</p>
            </div>
          )}

          {/* Blood Oxygen */}
          {ouraSummary.spo2?.spo2_percentage?.average != null && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Wind className="h-3.5 w-3.5" />
                Blood Oxygen
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {ouraSummary.spo2.spo2_percentage.average}%
              </p>
              <p className="text-xs text-gray-500">SpO2 average</p>
            </div>
          )}

          {/* Stress */}
          {ouraSummary.stress?.day_summary && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Brain className="h-3.5 w-3.5" />
                Stress
              </div>
              <p className="mt-1 text-lg font-bold capitalize text-gray-900">
                {ouraSummary.stress.day_summary}
              </p>
              <p className="text-xs text-gray-500">
                {ouraSummary.stress.recovery_high != null
                  ? `${Math.round(ouraSummary.stress.recovery_high / 60)}min recovery`
                  : "Daily summary"}
              </p>
            </div>
          )}

          {/* Resilience */}
          {ouraSummary.resilience?.level && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Shield className="h-3.5 w-3.5" />
                Resilience
              </div>
              <p className="mt-1 text-lg font-bold capitalize text-gray-900">
                {ouraSummary.resilience.level}
              </p>
              <p className="text-xs text-gray-500">Recovery capacity</p>
            </div>
          )}

          {/* VO2 Max */}
          {ouraSummary.vo2Max != null && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <TrendingUp className="h-3.5 w-3.5" />
                VO2 Max
              </div>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {ouraSummary.vo2Max.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">ml/kg/min</p>
            </div>
          )}
        </div>

        {/* Heart Rate Timeline */}
        {ouraSummary.heartRateReadings.length > 0 && (
          <div className="rounded-lg border border-gray-100 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <Heart className="h-3.5 w-3.5 text-red-400" />
              Heart Rate Today
              {moderateZone && (
                <span className="ml-auto font-normal text-gray-400">
                  Zone 2-3 for you: {moderateZone.minBpm}-{moderateZone.maxBpm} bpm
                </span>
              )}
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart
                data={ouraSummary.heartRateReadings.map((hr) => ({
                  t: new Date(hr.timestamp).getTime(),
                  bpm: hr.bpm,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                {moderateZone && (
                  <ReferenceArea
                    y1={moderateZone.minBpm}
                    y2={moderateZone.maxBpm}
                    fill="#10b981"
                    fillOpacity={0.08}
                    ifOverflow="hidden"
                  />
                )}
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  }
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                  width={32}
                  domain={["dataMin - 5", "dataMax + 5"]}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value) => {
                    const zone = classifyHeartRate(Number(value), age)
                    return [
                      `${value} bpm${zone ? ` · Zone ${zone.zone} (${zone.name})` : ""}`,
                      "Heart Rate",
                    ]
                  }}
                  labelFormatter={(t) =>
                    new Date(t).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  }
                />
                <Line
                  type="monotone"
                  dataKey="bpm"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Moon className="h-6 w-6 text-gray-300" />
        <p className="text-sm text-gray-500">
          Your Oura Ring is connected but there&apos;s no data for today yet.
        </p>
        <p className="text-xs text-gray-400">
          Sleep, activity, and readiness scores will appear here once your ring syncs.
        </p>
          </div>
        )}
    </InsightCard>
  )
}
