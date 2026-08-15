"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Footprints } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { createClient } from "@/lib/supabase/client"
import { InsightCard } from "@/components/ui/insight-card"
import { useUserQuery } from "@/lib/supabase/user-query"
import { useProfile } from "@/hooks/useProfile"
import { ouraSummaryQuery } from "@/lib/queries/oura"
import { daysAgoDateString, localToday } from "@/lib/dates"
import { CHIP_TONES } from "@/lib/constants"
import {
  parseMovementClasses,
  totalActiveMinutes,
  trailingIdleMinutes,
  stepPace,
  paceTone,
  paceLabel,
  paceDetail,
  stepTrend,
  hourLabel,
  formatMinutes,
  DEFAULT_STEP_GOAL,
  type HourlyMovement,
} from "@/lib/daily-movement"

const supabase = createClient()

/** Days of stored history behind the "7-day average" line. */
const TREND_DAYS = 7

/** A sitting run shorter than this isn't worth mentioning. */
const SITTING_NUDGE_MINUTES = 90

const INTENSITY_BARS = [
  { key: "lowMinutes" as const, label: "Low", color: "#c4b5fd" },
  { key: "mediumMinutes" as const, label: "Medium", color: "#8b5cf6" },
  { key: "highMinutes" as const, label: "High", color: "#6d28d9" },
]

/**
 * Today's movement: steps against a personal goal, whether that total is on
 * schedule for the time of day, and where the day's activity actually landed
 * on the clock.
 *
 * The two halves answer different questions from different data, and the card
 * is careful not to blur them. The step count is a running daily total —
 * Oura publishes no per-hour step series — so pacing compares it against the
 * clock rather than pretending to know when the steps happened. The chart
 * below is built from `class_5_min`, which is genuinely intraday, and is
 * labeled in *minutes of movement*, not steps.
 *
 * Self-fetching, and it shares the ["oura-summary"] key with the dashboard's
 * Oura card — so despite being a second Oura consumer it costs no second
 * fetch. Renders nothing until the ring is connected and has activity data.
 */
export function DailyMovementCard() {
  const { data: ouraResult, isLoading: ouraLoading } = useQuery(
    ouraSummaryQuery()
  )
  const { data: profile } = useProfile()

  const today = useMemo(() => localToday(), [])
  const goal = profile?.daily_step_goal ?? DEFAULT_STEP_GOAL
  const activity = ouraResult?.summary?.activity ?? null

  // Stored history for the weekly average. Today is fetched too and then
  // excluded by `stepTrend` — a partial total shouldn't drag the average.
  const { data: history } = useUserQuery(
    ["step-history", TREND_DAYS],
    async (userId: string) => {
      const { data, error } = await supabase
        .from("oura_daily")
        .select("day, steps")
        .eq("user_id", userId)
        .gte("day", daysAgoDateString(TREND_DAYS))
      if (error) throw error
      return (data ?? []).map((r) => ({ day: r.day, steps: r.steps }))
    }
  )

  const pace = useMemo(() => {
    if (!activity) return null
    const now = new Date()
    return stepPace(activity.steps ?? 0, goal, now.getHours(), now.getMinutes())
  }, [activity, goal])

  const hours: HourlyMovement[] = useMemo(
    () => parseMovementClasses(activity?.class_5_min, activity?.timestamp),
    [activity]
  )

  const activeMinutes = useMemo(() => totalActiveMinutes(hours), [hours])
  const sittingMinutes = useMemo(
    () => trailingIdleMinutes(activity?.class_5_min),
    [activity]
  )
  const trend = useMemo(
    () => stepTrend(history ?? [], goal, today),
    [history, goal, today]
  )

  // The ring isn't connected, or today has no activity document yet.
  if (!ouraLoading && (!ouraResult?.connected || !activity || !pace)) return null

  return (
    <InsightCard
      icon={Footprints}
      title="Daily Movement"
      isLoading={ouraLoading || !pace}
      skeletonHeight="h-56"
      action={
        pace && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              CHIP_TONES[paceTone(pace.status)]
            }`}
          >
            {paceLabel(pace.status)}
          </span>
        )
      }
    >
      {pace && (
        <div className="space-y-4">
          {/* Steps against the goal */}
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-gray-900">
                {pace.steps.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">
                / {pace.goal.toLocaleString()} steps
              </p>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100"
              role="progressbar"
              aria-valuenow={pace.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Step goal progress"
            >
              <div
                className={`h-full rounded-full transition-all ${
                  pace.status === "behind" ? "bg-amber-500" : "bg-purple-600"
                }`}
                style={{ width: `${pace.percent}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">{paceDetail(pace)}</p>
          </div>

          {/* When the movement actually happened */}
          {hours.length > 0 ? (
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-medium text-gray-600">
                  Movement by hour
                </p>
                <p className="text-xs text-gray-400">
                  {formatMinutes(activeMinutes)} active
                </p>
              </div>
              <div className="mt-1 h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={hours}
                    margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={hourLabel}
                      interval="preserveStartEnd"
                      minTickGap={24}
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 60]}
                      ticks={[0, 30, 60]}
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    {/* Half an hour of movement is a visible, reachable bar. */}
                    <ReferenceLine y={30} stroke="#e5e7eb" />
                    <Tooltip
                      formatter={(value, name) => [`${Number(value)}m`, name]}
                      labelFormatter={(hour) => `${hourLabel(Number(hour))} — movement`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    {INTENSITY_BARS.map((bar) => (
                      <Bar
                        key={bar.key}
                        dataKey={bar.key}
                        name={bar.label}
                        stackId="movement"
                        fill={bar.color}
                        radius={bar.key === "highMinutes" ? [2, 2, 0, 0] : 0}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex items-center justify-center gap-3">
                {INTENSITY_BARS.map((bar) => (
                  <span
                    key={bar.key}
                    className="flex items-center gap-1 text-xs text-gray-500"
                  >
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: bar.color }}
                      aria-hidden="true"
                    />
                    {bar.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Hourly movement appears once your ring syncs today&apos;s
              activity.
            </p>
          )}

          {/* The two readings worth a line of text */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {trend.average != null && (
              <span>
                {TREND_DAYS}-day avg{" "}
                <span className="font-medium text-gray-700">
                  {trend.average.toLocaleString()}
                </span>
                {trend.days > 0 && ` · ${trend.daysAtGoal}/${trend.days} at goal`}
              </span>
            )}
            {sittingMinutes >= SITTING_NUDGE_MINUTES && (
              <span className="text-amber-600">
                Sitting {formatMinutes(sittingMinutes)} — time to move
              </span>
            )}
          </div>
        </div>
      )}
    </InsightCard>
  )
}
