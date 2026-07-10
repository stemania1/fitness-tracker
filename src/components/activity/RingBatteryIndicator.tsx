"use client"

import { Battery, BatteryCharging } from "lucide-react"
import type { OuraRingBattery } from "@/lib/oura"

/** Color band for a battery level. */
function levelColor(level: number, charging: boolean): string {
  if (charging) return "text-emerald-600"
  if (level <= 15) return "text-red-500"
  if (level <= 35) return "text-amber-500"
  return "text-emerald-600"
}

function relativeTime(timestamp: string, now: number): string {
  const then = new Date(timestamp).getTime()
  if (!Number.isFinite(then)) return ""
  const mins = Math.round((now - then) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

interface RingBatteryIndicatorProps {
  battery: OuraRingBattery | null
  /** Injectable clock for deterministic tests; defaults to Date.now(). */
  now?: number
}

/**
 * Compact ring-battery pill for the Oura card header. Renders nothing when
 * battery data is unavailable (older token/scope, or endpoint absent).
 */
export function RingBatteryIndicator({
  battery,
  now,
}: RingBatteryIndicatorProps) {
  if (!battery || battery.level == null) return null

  const level = battery.level
  const charging = battery.charging === true
  const Icon = charging ? BatteryCharging : Battery
  const clock = now ?? Date.now()
  const updated = relativeTime(battery.timestamp, clock)

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${levelColor(
        level,
        charging
      )}`}
      title={`Ring battery${charging ? " (charging)" : ""}${
        updated ? ` · updated ${updated}` : ""
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{level}%</span>
      <span className="sr-only">
        Oura ring battery {level} percent{charging ? ", charging" : ""}
      </span>
    </span>
  )
}
