"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { WeeklyScheduleCard } from "@/components/activity/WeeklyScheduleCard"
import { WeightTrendCard } from "@/components/activity/WeightTrendCard"
import { MuscleBalanceCard } from "@/components/activity/MuscleBalanceCard"
import { EnergyBalanceCard } from "@/components/activity/EnergyBalanceCard"
import { EnergyDriversCard } from "@/components/activity/EnergyDriversCard"
import { SleepTrendCard } from "@/components/activity/SleepTrendCard"
import { RemInsightsCard } from "@/components/activity/RemInsightsCard"
import { RecoveryWatchCard } from "@/components/activity/RecoveryWatchCard"
import { Vo2MaxTrendCard } from "@/components/activity/Vo2MaxTrendCard"
import { WeeklyTrainingCard } from "@/components/activity/WeeklyTrainingCard"
import { RecentPRsCard } from "@/components/activity/RecentPRsCard"
import { RecentWorkoutsCard } from "@/components/activity/RecentWorkoutsCard"
import { VolumeTrendCard } from "@/components/activity/VolumeTrendCard"
import { useProfile } from "@/hooks/useProfile"
import { Section } from "@/components/layout/section"

const supabase = createClient()

/**
 * The analytical half of the app. The dashboard is for what's actionable
 * *today*; these are the multi-week reads you check occasionally rather than
 * scroll past every morning. Each card fetches its own data, so this page is
 * just layout.
 */
export default function InsightsPage() {
  // Only needed for the VO2 max percentile bands.
  const { data: profile } = useProfile()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
        <p className="mt-1 text-sm text-gray-500">
          The longer view — trends and patterns across weeks, rather than
          today&apos;s to-dos.
        </p>
      </div>

      <Section
        title="Weight"
        subtitle="What your intake and weight trend say about each other"
      >
        <WeightTrendCard />
        <EnergyBalanceCard />
      </Section>

      <Section
        title="Energy & sleep"
        subtitle="What actually moves your energy, and how you've been sleeping"
      >
        <EnergyDriversCard />
        <SleepTrendCard />
        <RemInsightsCard />
        <RecoveryWatchCard />
      </Section>

      <Section
        title="Training"
        subtitle="Balance, weekly load, and conditioning over time"
      >
        <RecentWorkoutsCard />
        <MuscleBalanceCard />
        <RecentPRsCard />
        <VolumeTrendCard />
        <WeeklyTrainingCard />
        <Vo2MaxTrendCard age={profile?.age} sex={profile?.sex} />
      </Section>

      <Section
        title="Planning"
        subtitle="A realistic week built from the time you actually have"
      >
        <WeeklyScheduleCard />
      </Section>
    </div>
  )
}
