"use client"

import {
  LineChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { TrendPoint } from "@/lib/goal-trend"

interface Props {
  points: TrendPoint[]
  target: number
  unit: string
}

/** Small progress line for a strength/endurance goal, with a dashed target
 *  reference line. Renders nothing until there are at least two points. */
export function GoalTrendChart({ points, target, unit }: Props) {
  if (points.length < 2) return null

  const data = points.map((p) => ({
    ...p,
    label: new Date(p.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }))
  const yMax = Math.max(target, ...points.map((p) => p.value))

  return (
    <div className="mt-1 h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[0, Math.ceil(yMax * 1.1)]} />
          <Tooltip
            cursor={{ stroke: "#e5e7eb" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as { label: string; value: number }
              return (
                <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs shadow-sm">
                  <span className="font-semibold text-gray-900">
                    {p.value} {unit}
                  </span>{" "}
                  <span className="text-gray-400">· {p.label}</span>
                </div>
              )
            }}
          />
          <ReferenceLine
            y={target}
            stroke="#a855f7"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#7c3aed"
            strokeWidth={2}
            dot={{ r: 2, fill: "#7c3aed" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
