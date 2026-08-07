"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { BatteryCharging, Sparkles, Moon } from "lucide-react"
import {
  assessEnergy,
  checkinPrompt,
  partOfDay,
  type EnergyLevel,
  type EnergyBand,
  type FuelState,
  type EnergyReadout,
} from "@/lib/energy"
import type { HrvStatus } from "@/lib/recovery"
import type { CaffeineLevel } from "@/lib/caffeine"
import { localToday } from "@/lib/dates"
import { useUserQuery, getAuthUserId } from "@/lib/supabase/user-query"
import { CARD_ACCENTS, CHIP_TONES, PANEL_TONES } from "@/lib/constants"
import { InsightCard } from "@/components/ui/insight-card"
import { useEnergyCheckin } from "@/hooks/useDailyLogs"

const supabase = createClient()

export interface EnergyCheckInCardProps {
  /** Oura sleep score for last night, 0-100. */
  sleepScore?: number | null
  /** Total sleep last night, in minutes. */
  sleepMinutes?: number | null
  /** Oura readiness score, 0-100. */
  readinessScore?: number | null
  /** HRV-vs-baseline status; used when readiness is unavailable. */
  hrvStatus?: HrvStatus | null
  /** Did the user log a workout today? */
  trainedHardToday?: boolean | null
  /** Fuel state for the day so far, when known. */
  fuel?: FuelState | null
  /** Current caffeine state, when caffeine has been logged today. */
  caffeine?: CaffeineLevel | null
  /** Forward-looking "late caffeine may hurt tonight's sleep" note, if any. */
  caffeineWarning?: string | null
}

const LEVELS: Array<{ value: EnergyLevel; label: string }> = [
  { value: 1, label: "Drained" },
  { value: 2, label: "Low" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Energized" },
]

const bandStyle: Record<EnergyBand, { chip: string; label: string }> = {
  low: { chip: CHIP_TONES.attention, label: "Low" },
  moderate: { chip: CHIP_TONES.neutral, label: "Moderate" },
  high: { chip: CHIP_TONES.progress, label: "High" },
}

const verdictStyle: Record<EnergyReadout["verdict"], string> = {
  matches: "border-emerald-200 bg-emerald-50",
  below: "border-amber-200 bg-amber-50",
  above: "border-gray-200 bg-gray-50",
}

/**
 * Energy check-in: log how you feel right now (1-5), then see whether it
 * matches what the day's signals — sleep, recovery, training, time of day —
 * would predict. Works on the subjective input alone; sharper with Oura data.
 */
export function EnergyCheckInCard({
  sleepScore,
  sleepMinutes,
  readinessScore,
  hrvStatus,
  trainedHardToday,
  fuel,
  caffeine,
  caffeineWarning,
}: EnergyCheckInCardProps) {
  const queryClient = useQueryClient()
  const [reselecting, setReselecting] = useState(false)

  const today = localToday()
  const { data: todaysLevel, isLoading } = useEnergyCheckin(today)

  const mutation = useMutation({
    mutationFn: async (level: EnergyLevel) => {
      const userId = await getAuthUserId()
      const hour = new Date().getHours()
      const { error } = await supabase.from("energy_checkins").insert({
        user_id: userId,
        level,
        logged_hour: hour,
        part_of_day: partOfDay(hour),
        logged_on: today,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["energy-checkins", today] })
      setReselecting(false)
    },
  })

  const felt = todaysLevel ?? null
  const showSelector = reselecting || felt == null

  // Compute the read against the current hour so the circadian shape is live.
  const { expectation, readout } = assessEnergy(
    {
      hour: new Date().getHours(),
      sleepScore,
      sleepMinutes,
      readinessScore,
      hrvStatus,
      trainedHardToday,
      fuel,
      caffeine,
    },
    felt
  )
  const band = bandStyle[expectation.band]

  return (
    <InsightCard
      icon={BatteryCharging}
      title="Energy Check-In"
      action={
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${band.chip}`}
          title="Expected energy from today's signals"
        >
          Expected: {band.label}
        </span>
      }
    >
        {isLoading ? (
          <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-full" />
          </div>
        ) : showSelector ? (
          <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {checkinPrompt(partOfDay(new Date().getHours()))}
        </p>
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Energy level">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(l.value)}
              className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 px-1 py-2 text-center transition-colors hover:border-purple-300 hover:bg-purple-50 disabled:opacity-50"
            >
              <span className="text-lg font-semibold text-gray-900">{l.value}</span>
              <span className="text-[10px] leading-tight text-gray-500">{l.label}</span>
            </button>
          ))}
        </div>
        {mutation.isError && (
          <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}
          </div>
        ) : readout ? (
          <div className="space-y-3">
        <div className={`rounded-lg border p-3 ${verdictStyle[readout.verdict]}`}>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Sparkles className="h-4 w-4 text-purple-600" />
            {readout.headline}
          </p>
          <p className="mt-1 text-sm text-gray-700">{readout.detail}</p>
        </div>

        {expectation.drivers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {expectation.drivers.map((d) => (
              <span
                key={d.label}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  d.direction === "up"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {d.direction === "up" ? "↑" : "↓"} {d.label}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setReselecting(true)}
          className="text-xs font-medium text-purple-600 hover:text-purple-700"
        >
          Update how I feel
        </button>
          </div>
        ) : null}

        {/* Forward-looking sleep note: shown whenever caffeine ran late today,
        independent of the current energy read. */}
        {caffeineWarning && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <Moon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <p className="text-xs text-amber-800">{caffeineWarning}</p>
          </div>
        )}
    </InsightCard>
  )
}
