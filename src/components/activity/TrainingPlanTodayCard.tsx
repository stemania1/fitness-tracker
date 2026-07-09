"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarCheck, ChevronRight, Moon, Timer } from "lucide-react"
import { PLAN_WEEKS } from "@/data/training-plan"
import { todayPlan } from "@/lib/training-plan"
import { readinessGate, type GateAction } from "@/lib/recovery"

const typeStyles: Record<string, string> = {
  cardio: "bg-cyan-100 text-cyan-700",
  strength: "bg-purple-100 text-purple-700",
  rest: "bg-gray-100 text-gray-600",
}

const gateStyles: Record<Exclude<GateAction, "none">, string> = {
  go: "bg-emerald-50 text-emerald-700",
  moderate: "bg-blue-50 text-blue-700",
  downshift: "bg-amber-50 text-amber-700",
}

interface TrainingPlanTodayCardProps {
  /** Today's Oura readiness score (0-100), when available. */
  readinessScore?: number | null
}

/**
 * Dashboard card showing today's prescribed session from the 12-week
 * VO2 Max + pull-up plan, with week/phase context and — when Oura
 * readiness is available — a keep/moderate/downshift recommendation.
 */
export function TrainingPlanTodayCard({
  readinessScore,
}: TrainingPlanTodayCardProps = {}) {
  const plan = useMemo(() => todayPlan(new Date()), [])
  const gate = useMemo(
    () => readinessGate(plan.session, readinessScore),
    [plan.session, readinessScore]
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-5 w-5 text-purple-500" />
            Today&apos;s Plan
          </CardTitle>
          {plan.week != null ? (
            <Badge className="bg-purple-100 text-purple-700">
              Week {plan.week} of {PLAN_WEEKS}
              {plan.phase ? ` · ${plan.phase.label}` : ""}
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600">Plan complete</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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

        {gate.action !== "none" && (
          <div className={`rounded-lg px-3 py-2 ${gateStyles[gate.action]}`}>
            <p className="text-xs font-semibold">{gate.headline}</p>
            <p className="mt-0.5 text-xs">{gate.detail}</p>
          </div>
        )}

        {plan.sessionNote && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
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
      </CardContent>
    </Card>
  )
}
