"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { BedDouble, Coffee, Moon } from "lucide-react"
import { buildBedtimePlan, formatClockTime } from "@/lib/bedtime"

const supabase = createClient()

/**
 * Sleep-anchored bedtime target: with a fixed wake time (an early commute,
 * say), sleep is won at night — there's no sleeping in to catch up. Works
 * backward from wake time + sleep goal to a target bedtime, wind-down time,
 * and last-safe-caffeine cutoff.
 */
export function BedtimeCard() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["bedtime-profile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data } = await supabase
        .from("user_profiles")
        .select("wake_time, sleep_goal_hours")
        .eq("id", user.id)
        .single()
      return data
    },
  })

  const plan = profile?.wake_time
    ? buildBedtimePlan(profile.wake_time, profile.sleep_goal_hours ?? undefined)
    : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BedDouble className="h-5 w-5 text-indigo-500" />
          Bedtime Target
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !plan ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Set your usual wake time in your profile and I&apos;ll work
              backward to a target bedtime and caffeine cutoff.
            </p>
            <Link
              href="/profile"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Set wake time →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold text-gray-900">
                {formatClockTime(plan.bedtime)}
              </p>
              <span className="text-xs text-gray-500">
                for {plan.sleepGoalHours}h · wake {formatClockTime(plan.wakeTime)}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                <Moon className="h-4 w-4 shrink-0 text-indigo-500" />
                <span>
                  Wind down by{" "}
                  <span className="font-semibold">
                    {formatClockTime(plan.windDownTime)}
                  </span>{" "}
                  — screens off, lights low.
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <Coffee className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Last coffee by{" "}
                  <span className="font-semibold">
                    {formatClockTime(plan.caffeineCutoff)}
                  </span>{" "}
                  to protect tonight&apos;s sleep.
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
