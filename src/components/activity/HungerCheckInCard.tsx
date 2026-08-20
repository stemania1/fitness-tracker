"use client"

import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Utensils } from "lucide-react"
import { HUNGER_LEVELS, MIN_GAP_HOURS, MAX_GAP_HOURS } from "@/lib/satiety"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"
import { useHungerLogs } from "@/hooks/useDailyLogs"
import { queryKeys } from "@/lib/queries/keys"

const supabase = createClient()

export interface HungerCheckInCardProps {
  /** The most recent meal logged today — what the rating is measuring. */
  lastMeal?: { description: string; loggedAt: string } | null
}

/** "3h 10m ago", or "just now" under a minute. */
function agoLabel(fromIso: string, now: number): string {
  const mins = Math.floor((now - new Date(fromIso).getTime()) / 60_000)
  if (!Number.isFinite(mins) || mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`
}

/**
 * Log how hungry you are right now, without waiting for a meal.
 *
 * The meal logger asks the same question, but only at the moments you happen
 * to eat — which is the wrong sampling window for what it measures. A
 * breakfast that failed shows up as being ravenous at 10:30, not as a mild
 * reading at noon, and the last meal of the day has no next meal to carry a
 * rating at all.
 *
 * One tap logs it. No Save button and no confirmation step: this gets used
 * mid-morning with a phone in one hand or it does not get used.
 */
export function HungerCheckInCard({ lastMeal }: HungerCheckInCardProps) {
  const [reselecting, setReselecting] = useState(false)
  const queryClient = useQueryClient()

  const dayStartIso = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])
  const { data: todaysLogs, isLoading } = useHungerLogs(dayStartIso)

  const latest = todaysLogs?.[todaysLogs.length - 1] ?? null
  const showSelector = reselecting || latest == null

  const mutation = useMutation({
    mutationFn: async (level: number) => {
      const userId = await getAuthUserId()
      const { error } = await supabase.from("hunger_logs").insert({
        user_id: userId,
        level,
        logged_at: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hungerToday(dayStartIso) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hungerLogs })
      setReselecting(false)
    },
  })

  const now = Date.now()
  const sinceMealHours = lastMeal
    ? (now - new Date(lastMeal.loggedAt).getTime()) / 3_600_000
    : null
  // Says up front whether this rating will count. A reading ninety minutes
  // after eating is real, but it isn't comparable to one at four hours, and
  // the analysis drops it — better to know that when tapping than to wonder
  // later why a diligently logged day produced nothing.
  const comparable =
    sinceMealHours != null &&
    sinceMealHours >= MIN_GAP_HOURS &&
    sinceMealHours <= MAX_GAP_HOURS

  return (
    <InsightCard
      icon={Utensils}
      title="Hunger Check-In"
      action={
        latest && !showSelector ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {agoLabel(latest.logged_at, now)}
          </span>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : showSelector ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">How hungry are you right now?</p>
          <div className="flex gap-1.5" role="group" aria-label="Hunger level">
            {HUNGER_LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(l.value)}
                className="min-h-11 flex-1 rounded-lg bg-gray-100 px-1 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                {l.label}
              </button>
            ))}
          </div>
          {lastMeal && (
            <p className="text-xs text-gray-500">
              {lastMeal.description} was {agoLabel(lastMeal.loggedAt, now)}
              {comparable
                ? " — a comparable gap, so this one counts."
                : ` — outside the ${MIN_GAP_HOURS}–${MAX_GAP_HOURS}h window the comparison uses, so it won't be scored.`}
            </p>
          )}
          {mutation.isError && (
            <p className="text-sm text-red-600">
              {(mutation.error as Error).message}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            You logged{" "}
            <span className="font-semibold text-gray-900">
              {HUNGER_LEVELS.find((l) => l.value === latest.level)?.label ??
                latest.level}
            </span>
            .
          </p>
          <button
            type="button"
            onClick={() => setReselecting(true)}
            className="text-xs font-medium text-purple-600 hover:text-purple-700"
          >
            Log hunger again
          </button>
        </div>
      )}
    </InsightCard>
  )
}
