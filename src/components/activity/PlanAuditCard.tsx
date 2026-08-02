"use client"

import { useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUserQuery } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"
import { Stethoscope } from "lucide-react"
import { auditPlanDays, type AuditVerdict } from "@/lib/plan-audit"
import { daysAgoDateString } from "@/lib/dates"
import { listPending, localStorageQueue } from "@/lib/pending-workouts"
import { startOfWeekISO } from "@/lib/weekly-progress"

const supabase = createClient()

const WINDOW_DAYS = 14

const VERDICT: Record<AuditVerdict, { label: string; cls: string }> = {
  done: { label: "logged", cls: "bg-emerald-50 text-emerald-700" },
  missing: { label: "no workout row", cls: "bg-amber-50 text-amber-800" },
  "name-mismatch": {
    label: "logged under another name",
    cls: "bg-purple-50 text-purple-700",
  },
  rest: { label: "rest", cls: "bg-gray-50 text-gray-500" },
  future: { label: "—", cls: "bg-gray-50 text-gray-500" },
}

/**
 * What the plan expected against what is actually in the database, day by day.
 *
 * A "Missed: …" nudge states a conclusion without its evidence, so someone who
 * did the session cannot tell whether the row is absent, named differently, or
 * a day off. This shows the inputs — including every workout logged that day
 * whatever its name — using the same matcher the nudge uses.
 *
 * Diagnostic, not a daily-use card: it lives on Profile, not the dashboard.
 */
export function PlanAuditCard() {
  const weekStart = useMemo(() => startOfWeekISO(), [])

  const { data, isLoading } = useUserQuery(
    ["plan-audit", WINDOW_DAYS],
    async (userId) => {
      const since = daysAgoDateString(WINDOW_DAYS + 1)
      const { data: rows, error } = await supabase
        .from("workout_logs")
        .select("name, started_at, finished_at")
        .eq("user_id", userId)
        .gte("started_at", `${since}T00:00:00`)
        .order("started_at", { ascending: false })
      if (error) throw error
      return rows ?? []
    }
  )

  const audit = useMemo(
    () => (data ? auditPlanDays(new Date(), WINDOW_DAYS, data) : []),
    [data]
  )

  const pending = useMemo(() => listPending(localStorageQueue), [])
  const thisWeekCount = (data ?? []).filter(
    (w) => new Date(w.started_at).getTime() >= new Date(weekStart).getTime()
  ).length

  return (
    <InsightCard
      icon={Stethoscope}
      title="Plan vs logged"
      subtitle={`The last ${WINDOW_DAYS} days, straight from the database`}
      isLoading={isLoading}
      skeletonHeight="h-48"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="font-semibold text-gray-900">{thisWeekCount}</p>
            <p className="text-gray-500">workout rows this week</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="font-semibold text-gray-900">{pending.length}</p>
            <p className="text-gray-500">queued offline</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-400">
          Week counted from {new Date(weekStart).toLocaleString()}
        </p>

        <div className="divide-y divide-gray-100">
          {audit.map((row) => {
            const v = VERDICT[row.verdict]
            return (
              <div key={row.day} className="py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-gray-900">
                    {row.weekday} {row.day.slice(5)}
                    {row.week != null && (
                      <span className="ml-1 font-normal text-gray-400">
                        wk {row.week}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${v.cls}`}
                  >
                    {v.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  expected: {row.isRest ? "rest" : row.expected}
                </p>
                {row.logged.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5">
                    {row.logged.map((l, i) => (
                      <li key={i} className="text-[10px] text-gray-400">
                        logged: &ldquo;{l.name}&rdquo; at{" "}
                        {new Date(l.started_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {l.finished_at ? "" : " · never finished"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[10px] leading-relaxed text-gray-400">
          &ldquo;Logged under another name&rdquo; means a workout exists that
          day but its name differs from the plan session, so the missed-session
          check does not match it. Quick Log names a workout after the exercise
          rather than the plan session, which is the usual cause.
        </p>
      </div>
    </InsightCard>
  )
}
