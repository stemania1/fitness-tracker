"use client"

import { useMemo } from "react"
import type { OuraSummary } from "@/lib/oura"
import { deriveFuelState, type FuelState } from "@/lib/energy"
import { caffeineStatus, lateCaffeineFlag } from "@/lib/caffeine"
import { computeReminders, type Reminder } from "@/lib/reminders"
import { normalizeReminderSettings } from "@/lib/reminder-settings"
import { macroTargets } from "@/lib/macro-targets"
import { DEFAULT_STEP_GOAL } from "@/lib/daily-movement"
import { localToday, localDateOf } from "@/lib/dates"
import { useProfile } from "@/hooks/useProfile"
import { useBedtimePlan } from "@/hooks/useBedtimePlan"
import {
  useFoodLogs,
  useCaffeineLogs,
  useCreatineLogs,
  useEnergyCheckin,
  useLastWeighIn,
} from "@/hooks/useDailyLogs"

/**
 * Everything the dashboard derives about *today*, in one place.
 *
 * The dashboard page was 577 lines: eleven queries, six memoized derivations
 * and twelve cards. Most of that was not layout — it was this, the work of
 * turning the day's raw logs into the handful of values the cards actually
 * take as props. Pulling it out leaves the page as composition, and makes
 * these derivations testable without mounting a page.
 *
 * Every read here is a shared hook, so the values agree with the cards
 * rendering the same data a few hundred pixels below.
 */

export interface TodaysSignals {
  fuel: FuelState | null
  caffeineLevel: ReturnType<typeof caffeineStatus>["level"] | null
  caffeineWarning: string | null
  trainedToday: boolean
  sleepMinutesLastNight: number | null
  reminders: Reminder[]
  nutritionTargets: ReturnType<typeof macroTargets>
}

export function useTodaysSignals(
  ouraSummary: OuraSummary | null,
  allWorkoutLogs: { started_at: string }[] | undefined
): TodaysSignals {
  const today = localToday()
  const { data: profile } = useProfile()
  const { plan: bedtimePlan } = useBedtimePlan()

  // Local midnight as the lower bound, and the next midnight as the upper —
  // the same window the Nutrition card paginates over.
  const dayStartIso = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])
  const dayEndIso = useMemo(
    () => new Date(new Date(dayStartIso).getTime() + 86_400_000).toISOString(),
    [dayStartIso]
  )

  const { data: foodLogs } = useFoodLogs(dayStartIso, dayEndIso)
  const { data: caffeineLogs } = useCaffeineLogs(dayStartIso)
  const { data: creatineData } = useCreatineLogs(today)
  const { data: energyLevel } = useEnergyCheckin(today)
  const { data: lastWeighInAt } = useLastWeighIn()

  const nutritionTargets = useMemo(() => macroTargets(profile), [profile])

  const trainedToday = useMemo(
    () =>
      allWorkoutLogs
        ? allWorkoutLogs.some((w) => localDateOf(w.started_at) === today)
        : false,
    [allWorkoutLogs, today]
  )

  const sleepMinutesLastNight =
    ouraSummary?.sleepPeriod?.total_sleep_duration != null
      ? Math.round(ouraSummary.sleepPeriod.total_sleep_duration / 60)
      : null

  const fuel = useMemo(() => {
    if (!foodLogs) return null
    const caloriesConsumed = foodLogs.reduce((sum, m) => sum + m.calories, 0)
    const lastMeal = foodLogs[foodLogs.length - 1]
    return deriveFuelState({
      hour: new Date().getHours(),
      caloriesConsumed,
      calorieTarget: nutritionTargets?.calories ?? null,
      minutesSinceLastMeal: lastMeal
        ? Math.round(
            (Date.now() - new Date(lastMeal.logged_at).getTime()) / 60000
          )
        : null,
    })
  }, [foodLogs, nutritionTargets])

  const { caffeineLevel, caffeineWarning } = useMemo(() => {
    if (!caffeineLogs || caffeineLogs.length === 0) {
      return { caffeineLevel: null, caffeineWarning: null }
    }
    const now = Date.now()
    const doses = caffeineLogs.map((c) => {
      const t = new Date(c.logged_at)
      return {
        mg: c.mg,
        minutesAgo: Math.round((now - t.getTime()) / 60000),
        hour: t.getHours(),
        minute: t.getMinutes(),
      }
    })
    const status = caffeineStatus(doses)
    const flag = lateCaffeineFlag(doses, bedtimePlan?.caffeineCutoff)
    return {
      caffeineLevel: status.level === "none" ? null : status.level,
      caffeineWarning: flag.late ? flag.message : null,
    }
  }, [caffeineLogs, bedtimePlan?.caffeineCutoff])

  const reminders = useMemo(() => {
    const now = new Date()
    const startOfDayMs = (d: Date) => {
      const x = new Date(d)
      x.setHours(0, 0, 0, 0)
      return x.getTime()
    }
    const today0 = startOfDayMs(now)
    const dayDiff = (iso: string) =>
      Math.round((today0 - startOfDayMs(new Date(iso))) / 86_400_000)

    // While a query is still loading, feed a value that suppresses its nudge
    // so nothing flashes before the data lands.
    const daysSinceLastWorkout =
      allWorkoutLogs === undefined
        ? 0
        : allWorkoutLogs.length === 0
          ? null
          : dayDiff(allWorkoutLogs[allWorkoutLogs.length - 1].started_at)

    const daysSinceLastWeighIn =
      lastWeighInAt === undefined
        ? 0
        : lastWeighInAt === null
          ? null
          : dayDiff(lastWeighInAt)

    return computeReminders(
      {
        hour: now.getHours(),
        mealsLoggedToday: foodLogs === undefined ? 99 : foodLogs.length,
        workedOutToday: trainedToday,
        daysSinceLastWorkout,
        energyCheckedInToday:
          energyLevel === undefined ? true : energyLevel !== null,
        daysSinceLastWeighIn,
        creatineTakenToday:
          creatineData === undefined
            ? true
            : creatineData.logs.some((l) => l.taken_on === today),
        // Null whenever there's no ring or no activity document yet, which
        // suppresses the nudge rather than reading an absent ring as a
        // sedentary day.
        stepsToday: ouraSummary?.activity?.steps ?? null,
        stepGoal: profile?.daily_step_goal ?? DEFAULT_STEP_GOAL,
      },
      normalizeReminderSettings(profile?.reminder_settings)
    )
  }, [
    allWorkoutLogs,
    lastWeighInAt,
    foodLogs,
    trainedToday,
    energyLevel,
    creatineData,
    today,
    ouraSummary?.activity?.steps,
    profile?.daily_step_goal,
    profile?.reminder_settings,
  ])

  return {
    fuel,
    caffeineLevel,
    caffeineWarning,
    trainedToday,
    sleepMinutesLastNight,
    reminders,
    nutritionTargets,
  }
}
