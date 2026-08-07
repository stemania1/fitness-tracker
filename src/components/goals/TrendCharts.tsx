"use client"

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Scale, Dumbbell } from "lucide-react"
import type { VolumeWeek } from "@/lib/goal-stats"

export interface TrendChartsProps {
  weightChartData: Array<{ date: string; weight: number }>
  volumeChartData: VolumeWeek[]
}

/**
 * The Goals page's two history charts (weight line, weekly-volume bars).
 * A separate component so the page can load it — and Recharts with it —
 * after first paint.
 */
export function TrendCharts({
  weightChartData,
  volumeChartData,
}: TrendChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Weight Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-5 w-5 text-blue-600" />
            Weight Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weightChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  domain={["dataMin - 5", "dataMax + 5"]}
                />
                <Tooltip />
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
            <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
              No weight logs yet. Log your weight to see trends.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Volume Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="h-5 w-5 text-purple-600" />
            Volume Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {volumeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={volumeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <Tooltip />
                <Bar
                  dataKey="volume"
                  fill="#7c3aed"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
              No workout data yet. Complete workouts to see volume trends.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
