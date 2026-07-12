"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, TrendingDown, TrendingUp, Stethoscope } from "lucide-react"
import { hrvBaseline, type HrvStatus } from "@/lib/recovery"
import type { DailyMetrics } from "@/lib/sleep-insights"
import { EMERGENCY_NOTE, shouldSuggestClinician } from "@/data/seek-care"

const statusBadge: Record<HrvStatus, { label: string; className: string }> = {
  normal: { label: "On track", className: "bg-emerald-100 text-emerald-700" },
  suppressed: { label: "Watch", className: "bg-amber-100 text-amber-700" },
  low: { label: "Overreaching", className: "bg-red-100 text-red-700" },
  insufficient: { label: "Building baseline", className: "bg-gray-100 text-gray-500" },
}

const bannerClass: Record<HrvStatus, string> = {
  normal: "bg-emerald-50 text-emerald-700",
  suppressed: "bg-amber-50 text-amber-700",
  low: "bg-red-50 text-red-700",
  insufficient: "bg-gray-50 text-gray-500",
}

export function RecoveryWatchCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["oura-metrics", 60],
    queryFn: async (): Promise<DailyMetrics[]> => {
      const res = await fetch(`/api/oura/metrics?days=60`)
      if (res.status === 404) return [] // Oura not connected
      if (!res.ok) throw new Error("Failed to load Oura metrics")
      const body = (await res.json()) as { data?: DailyMetrics[] }
      return body.data ?? []
    },
  })

  const metrics = useMemo(() => data ?? [], [data])
  const baseline = useMemo(() => hrvBaseline(metrics), [metrics])

  const hasAnyHrv = metrics.some((m) => m.averageHrv != null)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-rose-500" />
            Recovery Watch
          </CardTitle>
          <Badge className={statusBadge[baseline.status].className}>
            {statusBadge[baseline.status].label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isError ? (
          <p className="py-4 text-center text-sm text-gray-500">
            Unable to load Oura HRV data right now.
          </p>
        ) : !hasAnyHrv ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Activity className="h-6 w-6 text-gray-300" />
            <p className="text-sm text-gray-500">No HRV history yet.</p>
            <p className="text-xs text-gray-400">
              Connect your Oura Ring on the Profile page — an HRV baseline
              builds over about three weeks of nights.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {baseline.recentAvg != null && baseline.baselineAvg != null && (
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-gray-500">7-night HRV</p>
                  <p className="text-xl font-bold text-gray-900">
                    {baseline.recentAvg}
                    <span className="ml-1 text-xs font-normal text-gray-500">
                      ms
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Baseline</p>
                  <p className="text-xl font-bold text-gray-900">
                    {baseline.baselineAvg}
                    <span className="ml-1 text-xs font-normal text-gray-500">
                      ms
                    </span>
                  </p>
                </div>
                {baseline.deltaPct != null && (
                  <div className="ml-auto flex items-center gap-1">
                    {baseline.deltaPct >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-amber-500" />
                    )}
                    <span
                      className={`text-lg font-bold ${
                        baseline.deltaPct >= 0
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }`}
                    >
                      {baseline.deltaPct >= 0 ? "+" : ""}
                      {baseline.deltaPct}%
                    </span>
                  </div>
                )}
              </div>
            )}

            <p
              className={`rounded-lg px-3 py-2 text-xs ${bannerClass[baseline.status]}`}
            >
              {baseline.message}
            </p>

            {shouldSuggestClinician(baseline.status) && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-xs text-red-700">
                  If your HRV stays this far below baseline for a week or more
                  even with easy days and good sleep, it&apos;s worth a doctor
                  visit — sustained suppression can reflect more than training
                  fatigue. This is a screening cue, not a diagnosis.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Always-present, non-diagnostic emergency reminder. */}
        <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] leading-relaxed text-gray-400">
          {EMERGENCY_NOTE}
        </p>
      </CardContent>
    </Card>
  )
}
