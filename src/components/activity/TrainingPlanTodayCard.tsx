"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { CalendarCheck, ChevronRight, Moon, Timer } from "lucide-react"
import { PLAN_WEEKS } from "@/data/training-plan"
import { todayPlan, planWeekNumber } from "@/lib/training-plan"
import { readinessGate, type GateAction } from "@/lib/recovery"
import type { PlanSuggestion } from "@/lib/plan-adaptation"
import { DayNav } from "./DayNav"
import { dayLabel, offsetDate } from "@/lib/day-nav"
import { useSwipe } from "@/hooks/useSwipe"
import { CARD_ACCENTS, CHIP_TONES, PANEL_TONES } from "@/lib/constants"
import { InsightCard } from "@/components/ui/insight-card"

const typeStyles: Record<string, string> = {
  cardio: CHIP_TONES.brand,
  strength: CHIP_TONES.brand,
  rest: CHIP_TONES.neutral,
}

const gateStyles: Record<Exclude<GateAction, "none">, string> = {
  go: PANEL_TONES.progress,
  moderate: PANEL_TONES.neutral,
  downshift: PANEL_TONES.attention,
}

interface TrainingPlanTodayCardProps {
  /** Today's Oura readiness score (0-100), when available. */
  readinessScore?: number | null
  /** Missed-session suggestion from lib/plan-adaptation, when one applies. */
  suggestion?: PlanSuggestion | null
}

/**
 * Dashboard card showing today's prescribed session from the 12-week
 * VO2 Max + pull-up plan, with week/phase context and — when Oura
 * readiness is available — a keep/moderate/downshift recommendation.
 */
export function TrainingPlanTodayCard({
  readinessScore,
  suggestion,
}: TrainingPlanTodayCardProps = {}) {
  // Swipe / arrows step through days: 0 = today, +1 = tomorrow, … Backwards
  // stops at today (this card looks ahead); forwards stops at the plan's end.
  const [offset, setOffset] = useState(0)
  const isToday = offset === 0

  const plan = useMemo(() => todayPlan(offsetDate(offset)), [offset])
  // Readiness gate and missed-session catch-up are about *today* specifically.
  const gate = useMemo(
    () => (isToday ? readinessGate(plan.session, readinessScore) : { action: "none" as const, headline: "", detail: "" }),
    [isToday, plan.session, readinessScore]
  )

  const nextInPlan = planWeekNumber(offsetDate(offset + 1)) != null
  const swipe = useSwipe(
    () => nextInPlan && setOffset((o) => o + 1),
    () => !isToday && setOffset((o) => o - 1)
  )

  return (
    <InsightCard
      icon={CalendarCheck}
      accent="brand"
      title={
        <DayNav
          label={`${dayLabel(offset)}'s Plan`}
          onPrev={isToday ? undefined : () => setOffset((o) => o - 1)}
          onNext={nextInPlan ? () => setOffset((o) => o + 1) : undefined}
        />
      }
      action={
        plan.week != null ? (
          <Badge className="bg-purple-100 text-purple-700">
            Week {plan.week} of {PLAN_WEEKS}
            {plan.phase ? ` · ${plan.phase.label}` : ""}
          </Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-600">Plan complete</Badge>
        )
      }
    >
        <div className="flex items-start gap-3">
          <div
        className={`mt-0.5 rounded-lg p-2 ${typeStyles[plan.session.type]}`}
          >
        {plan.session.type === "rest" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Timer className="h-4 w-4" />
        )}
          </div>
          <div className="min-w-0">
        <p className="font-semibold text-gray-900">
          {plan.session.title}
          {plan.session.time && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              {plan.session.time} · {plan.session.durationMins} min
            </span>
          )}
        </p>
        <ul className="mt-1 space-y-0.5 text-sm text-gray-600">
          {plan.session.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
          </div>
        </div>

        {/* Missed-work catch-up, suggestion-only: the app proposes, the
        user decides. Only relevant to today. */}
        {isToday && suggestion && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <p className="font-semibold">{suggestion.headline}</p>
        <p className="mt-0.5">{suggestion.detail}</p>
          </div>
        )}

        {gate.action !== "none" && (
          <div className={`rounded-lg px-3 py-2 ${gateStyles[gate.action]}`}>
        <p className="text-xs font-semibold">{gate.headline}</p>
        <p className="mt-0.5 text-xs">{gate.detail}</p>
          </div>
        )}

        {plan.sessionNote && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
        {plan.sessionNote}
          </p>
        )}

        {plan.isDeload && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Deload week — recover, don&apos;t chase numbers.
          </p>
        )}

        {plan.testTitle && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        {plan.testTitle} this weekend — log results via Log Test below.
          </p>
        )}

        {plan.week == null && (
          <p className="text-xs text-gray-500">
        The 12 weeks are done — retest, then set the next block&apos;s
        goals.
          </p>
        )}

        <Link
          href="/plan"
          className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          View full plan
          <ChevronRight className="h-4 w-4" />
        </Link>
    </InsightCard>
  )
}
