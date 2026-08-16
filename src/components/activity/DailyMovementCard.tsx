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
import { InsightCard } from "@/components/ui/insight-card"
import { useProfile } from "@/hooks/useProfile"
import { ouraSummaryQuery } from "@/lib/queries/oura"
import { localToday } from "@/lib/dates"
import {
  useMovementHistory,
  hasMovementData,
} from "@/hooks/useMovementHistory"
import { CHIP_TONES } from "@/lib/constants"
import {
  movementHours,
  totalActiveMinutes,
  sittingMinutes,
  activeMinutesFrom,
  stepPace,
  activeMinutesPace,
  activeMinutesDetail,
  paceTone,
  paceLabel,
  paceDetail,
  dailyTrend,
  hourLabel,
  formatMinutes,
  DEFAULT_STEP_GOAL,
  DEFAULT_ACTIVE_MINUTES_GOAL,
  type DailyPace,
  type HourlyMovement,
} from "@/lib/daily-movement"

/** Days of stored history behind the "7-day average" line. */
const TREND_DAYS = 7

/** A sitting run shorter than this isn't worth mentioning. */
const SITTING_NUDGE_MINUTES = 90

// The top two bands are what the activity goal counts, so the chart explains
// the "N / 30 min moderate+" row above it rather than sitting beside it
// unexplained. They agree to the minute on the MET path; on the class_5_min
// fallback the row uses Oura's own daily totals, which can differ by a minute
// or two from summing five-minute buckets.
const INTENSITY_BARS = [
  { key: "lowMinutes" as const, label: "Light", color: "#c4b5fd" },
  { key: "mediumMinutes" as const, label: "Moderate", color: "#8b5cf6" },
  { key: "highMinutes" as const, label: "Vigorous", color: "#6d28d9" },
]

/**
 * Today's movement: steps against a personal goal, whether that total is on
 * schedule for the time of day, and where the day's activity actually landed
 * on the clock.
 *
 * The two halves answer different questions from different data, and the card
 * is careful not to blur them. The step count is a running daily total —
 * Oura publishes no per-hour step series, and no raw accelerometer either —
 * so pacing compares it against the clock rather than pretending to know when
 * the steps happened. The chart below is genuinely intraday, from per-minute
 * MET (or five-minute activity classes as a fallback), and is labeled in
 * *minutes of movement*, not steps.
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
  const minutesGoal =
    profile?.daily_active_minutes_goal ?? DEFAULT_ACTIVE_MINUTES_GOAL
  const activity = ouraResult?.summary?.activity ?? null

  // Stored history for the weekly averages. Shared with the dashboard page
  // under one key, so the section gate and the card agree. Today is fetched
  // too and then excluded by `dailyTrend` — a partial total shouldn't drag
  // the average.
  const { data: history } = useMovementHistory(TREND_DAYS)

  const pace = useMemo(() => {
    if (!activity) return null
    const now = new Date()
    return stepPace(activity.steps ?? 0, goal, now.getHours(), now.getMinutes())
  }, [activity, goal])

  // Moderate + high only — see activeMinutesFrom. This is deliberately a
  // different number from the chart's "moving" total below, which includes
  // the low band.
  const minutesPace: DailyPace | null = useMemo(() => {
    if (!activity) return null
    const now = new Date()
    return activeMinutesPace(
      activeMinutesFrom(activity),
      minutesGoal,
      now.getHours(),
      now.getMinutes()
    )
  }, [activity, minutesGoal])

  // Per-minute MET where Oura sends it, five-minute classes otherwise.
  const hours: HourlyMovement[] = useMemo(
    () => movementHours(activity),
    [activity]
  )

  const activeMinutes = useMemo(() => totalActiveMinutes(hours), [hours])
  const sitting = useMemo(() => {
    const now = new Date()
    return sittingMinutes(activity, now.getHours(), now.getMinutes())
  }, [activity])
  const trend = useMemo(
    () =>
      dailyTrend(
        (history?.ring ?? []).map((r) => ({ day: r.day, value: r.steps })),
        goal,
        today
      ),
    [history, goal, today]
  )
  const minutesTrend = useMemo(
    () =>
      dailyTrend(
        (history?.ring ?? []).map((r) => ({
          day: r.day,
          value: r.active_minutes,
        })),
        minutesGoal,
        today
      ),
    [history, minutesGoal, today]
  )

  // Hidden only for someone with no ring and no stored history at all.
  //
  // Notably NOT hidden when the ring is connected but today has no document
  // yet. That was the original behavior and it was the wrong call: a day the
  // ring didn't report made the whole section disappear without a word, which
  // reads as a bug rather than as missing data. Now it says so.
  if (
    !ouraLoading &&
    !ouraResult?.connected &&
    !activity &&
    !hasMovementData(history)
  ) {
    return null
  }

  return (
    <InsightCard
      icon={Footprints}
      title="Daily Movement"
      isLoading={ouraLoading}
      skeletonHeight="h-56"
      isEmpty={!activity}
      empty={
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            No movement data for today yet.
          </p>
          <p className="text-xs text-gray-400">
            {ouraResult?.connected
              ? "Your ring hasn't reported today's activity. This fills in once it syncs."
              : "Connect your Oura ring in Profile to track steps and activity."}
          </p>
        </div>
      }
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
                {pace.value.toLocaleString()}
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

          {/* Moderate+ minutes — the intensity half of the picture. Steps say
              how much you moved; this says how hard, and a day can pass one
              while failing the other. */}
          {minutesPace && (
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold text-gray-900">
                    {minutesPace.value}
                  </p>
                  <p className="text-sm text-gray-500">
                    / {minutesPace.goal} min moderate+
                  </p>
                </div>
                {minutesPace.status === "goal-met" && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHIP_TONES.progress}`}
                  >
                    Met
                  </span>
                )}
              </div>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-valuenow={minutesPace.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Active minutes goal progress"
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${minutesPace.percent}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                {activeMinutesDetail(minutesPace)}
              </p>
            </div>
          )}

          {/* When the movement actually happened */}
          {hours.length > 0 ? (
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-medium text-gray-600">
                  Movement by hour
                </p>
                {/* "moving", not "active": this total includes the low band,
                    so calling it active would contradict the moderate+ goal
                    a few lines above. */}
                <p className="text-xs text-gray-400">
                  {formatMinutes(activeMinutes)} moving
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
            {minutesTrend.average != null && (
              <span>
                Moderate+{" "}
                <span className="font-medium text-gray-700">
                  {minutesTrend.average} min/day
                </span>
                {minutesTrend.days > 0 &&
                  ` · ${minutesTrend.daysAtGoal}/${minutesTrend.days} at goal`}
              </span>
            )}
            {sitting >= SITTING_NUDGE_MINUTES && (
              <span className="text-amber-600">
                Sitting {formatMinutes(sitting)} — time to move
              </span>
            )}
          </div>
        </div>
      )}
    </InsightCard>
  )
}
