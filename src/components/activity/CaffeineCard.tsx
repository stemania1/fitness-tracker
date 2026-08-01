"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Coffee, Trash2, Moon, Pencil } from "lucide-react"
import {
  caffeineStatus,
  lateCaffeineFlag,
  formatHour,
  DAILY_CAFFEINE_GUIDELINE_MG,
  type CaffeineDose,
} from "@/lib/caffeine"
import { localTimeValue, withLocalTime } from "@/lib/meal-time"
import { useBedtimePlan } from "@/hooks/useBedtimePlan"
import { useUserQuery, getAuthUserId } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"

const supabase = createClient()

interface CaffeineRow {
  id: string
  mg: number
  source: string | null
  logged_at: string
}

/** Local midnight ISO for the "today" query window. */
function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const levelLabel: Record<string, { text: string; cls: string }> = {
  active: { text: "Active", cls: "text-amber-700" },
  fading: { text: "Wearing off", cls: "text-gray-500" },
  none: { text: "Cleared", cls: "text-emerald-600" },
}

/**
 * Today's caffeine at a glance: total vs. the daily guideline, how much is
 * still active right now, the late-caffeine sleep warning, and the day's
 * drinks. Complements the Log Caffeine action and the Energy Check-In, which
 * only shows caffeine as a driver.
 */
export function CaffeineCard() {
  const dayStart = useMemo(() => startOfTodayIso(), [])
  const queryClient = useQueryClient()
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  // Inline edit of a logged drink's time-of-day.
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null)
  const [timeDraft, setTimeDraft] = useState("")

  const { data: logs, isLoading } = useUserQuery(
    ["caffeine-today-list", dayStart],
    async (userId: string): Promise<CaffeineRow[]> => {
      const { data, error } = await supabase
        .from("caffeine_logs")
        .select("id, mg, source, logged_at")
        .eq("user_id", userId)
        .gte("logged_at", dayStart)
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data ?? []
    }
  )

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const userId = await getAuthUserId()
      const { error } = await supabase
        .from("caffeine_logs")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onMutate: (id) => setPendingId(id),
    onSettled: () => {
      setPendingId(null)
      setArmedDeleteId(null)
    },
    onSuccess: () => {
      // Refresh both this card and the energy read's caffeine signal.
      queryClient.invalidateQueries({ queryKey: ["caffeine-today-list"] })
      queryClient.invalidateQueries({ queryKey: ["caffeine-today"] })
    },
  })

  // Correct a drink's logged time in place — timing drives the "still active"
  // and late-caffeine sleep signals, so a wrong time matters here.
  const updateTimeMutation = useMutation({
    mutationFn: async ({ id, loggedAt }: { id: string; loggedAt: string }) => {
      const userId = await getAuthUserId()
      const { error } = await supabase
        .from("caffeine_logs")
        .update({ logged_at: loggedAt })
        .eq("id", id)
      if (error) throw error
    },
    onMutate: ({ id }) => setPendingId(id),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caffeine-today-list"] })
      queryClient.invalidateQueries({ queryKey: ["caffeine-today"] })
      setEditingTimeId(null)
    },
  })

  // Judge "late" against the user's own cutoff, not a generic 2pm.
  const { plan } = useBedtimePlan()
  const cutoff = plan?.caffeineCutoff

  const { status, late } = useMemo(() => {
    const now = Date.now()
    const doses: CaffeineDose[] = (logs ?? []).map((r) => {
      const t = new Date(r.logged_at)
      return {
        mg: r.mg,
        minutesAgo: Math.round((now - t.getTime()) / 60000),
        hour: t.getHours(),
        minute: t.getMinutes(),
      }
    })
    return {
      status: caffeineStatus(doses),
      late: lateCaffeineFlag(doses, cutoff),
    }
  }, [logs, cutoff])

  const total = status.totalTodayMg
  const overGuideline = total > DAILY_CAFFEINE_GUIDELINE_MG
  const pct = Math.min(100, (total / DAILY_CAFFEINE_GUIDELINE_MG) * 100)

  return (
    <InsightCard
      icon={Coffee}
      title="Today&apos;s Caffeine"
    >
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (logs ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Coffee className="h-6 w-6 text-gray-300" />
        <p className="text-sm text-gray-500">No caffeine logged today.</p>
        <p className="text-xs text-gray-400">
          Tap <span className="font-medium">Log Caffeine</span> above to track a drink.
        </p>
          </div>
        ) : (
          <div className="space-y-4">
        <div className="flex items-baseline gap-3">
          <p className="text-2xl font-bold text-gray-900">
        {total}
        <span className="ml-1 text-xs font-normal text-gray-500">
          mg · of {DAILY_CAFFEINE_GUIDELINE_MG}
        </span>
          </p>
          {status.onBoardMg > 0 && (
        <p className="ml-auto text-sm text-gray-600">
          <span className={`font-semibold ${levelLabel[status.level].cls}`}>
            ~{status.onBoardMg} mg
          </span>{" "}
          <span className="text-xs text-gray-400">still active</span>
        </p>
          )}
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-label="Caffeine vs daily guideline"
          aria-valuenow={total}
          aria-valuemax={DAILY_CAFFEINE_GUIDELINE_MG}
        >
          <div
        className={`h-full rounded-full ${overGuideline ? "bg-red-400" : "bg-amber-400"}`}
        style={{ width: `${pct}%` }}
          />
        </div>

        {overGuideline && (
          <p className="text-xs text-red-600">
        Over the {DAILY_CAFFEINE_GUIDELINE_MG} mg daily guideline.
          </p>
        )}

        {late.late && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <Moon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <p className="text-xs text-amber-800">{late.message}</p>
          </div>
        )}

        <ul className="space-y-1.5">
          {(logs ?? []).map((r) => (
        <li
          key={r.id}
          className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {r.source ?? "Caffeine"}
            </p>
            {editingTimeId === r.id ? (
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                <input
                  type="time"
                  value={timeDraft}
                  onChange={(e) => setTimeDraft(e.target.value)}
                  aria-label={`Logged time for ${r.source ?? "caffeine"}`}
                  className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  onClick={() =>
                    timeDraft &&
                    updateTimeMutation.mutate({
                      id: r.id,
                      loggedAt: withLocalTime(r.logged_at, timeDraft),
                    })
                  }
                  disabled={pendingId === r.id || !timeDraft}
                  className="font-medium text-purple-600 hover:underline disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingTimeId(null)}
                  className="text-gray-400 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span>
                  {formatHour(new Date(r.logged_at).getHours())}
                </span>
                <button
                  onClick={() => {
                    setEditingTimeId(r.id)
                    setTimeDraft(localTimeValue(r.logged_at))
                  }}
                  aria-label={`Edit logged time for ${r.source ?? "caffeine"}`}
                  className="inline-flex items-center gap-0.5 text-purple-600 hover:underline"
                >
                  <Pencil className="h-2.5 w-2.5" />
                  Edit
                </button>
              </div>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold text-gray-900">
            {r.mg} mg
          </span>
          <button
            onClick={() =>
              armedDeleteId === r.id
                ? deleteMutation.mutate(r.id)
                : setArmedDeleteId(r.id)
            }
            disabled={pendingId === r.id}
            className={`shrink-0 rounded-md p-1 transition-colors disabled:opacity-40 ${
              armedDeleteId === r.id
                ? "bg-red-50 text-red-600"
                : "text-gray-400 hover:bg-red-50 hover:text-red-500"
            }`}
            title={armedDeleteId === r.id ? "Tap again to delete" : "Delete this entry"}
            aria-label={
              armedDeleteId === r.id
                ? `Confirm delete of ${r.source ?? "caffeine"}`
                : `Delete ${r.source ?? "caffeine"}`
            }
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
          ))}
        </ul>
          </div>
        )}
    </InsightCard>
  )
}
