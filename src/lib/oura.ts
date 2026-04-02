/**
 * Oura Ring API helper.
 * Fetches sleep, activity, readiness, heart rate, SpO2, stress,
 * resilience, and VO2 max data.
 */

const OURA_API_BASE = "https://api.ouraring.com/v2/usercollection"

export interface OuraDailySleep {
  id: string
  day: string
  score: number | null
  total_sleep_duration: number | null // seconds
  deep_sleep_duration: number | null
  rem_sleep_duration: number | null
  light_sleep_duration: number | null
  efficiency: number | null
}

export interface OuraSleepPeriod {
  id: string
  day: string
  type: "long_sleep" | "late_nap" | "rest" | "sleep"
  total_sleep_duration: number | null // seconds
  deep_sleep_duration: number | null
  rem_sleep_duration: number | null
  light_sleep_duration: number | null
  time_in_bed: number | null // seconds
  efficiency: number | null
  average_heart_rate: number | null
  lowest_heart_rate: number | null
  average_hrv: number | null
}

export interface OuraDailyActivity {
  id: string
  day: string
  score: number | null
  active_calories: number
  total_calories: number
  steps: number
  equivalent_walking_distance: number // meters
  high_activity_time: number // seconds
  medium_activity_time: number // seconds
  low_activity_time: number // seconds
}

export interface OuraDailyReadiness {
  id: string
  day: string
  score: number | null
  temperature_deviation: number | null
  contributors: {
    activity_balance: number | null
    body_temperature: number | null
    hrv_balance: number | null
    previous_day_activity: number | null
    previous_night: number | null
    recovery_index: number | null
    resting_heart_rate: number | null
    sleep_balance: number | null
  }
}

export interface OuraHeartRate {
  bpm: number
  source: string
  timestamp: string
}

export interface OuraDailySpo2 {
  id: string
  day: string
  spo2_percentage: {
    average: number | null
  } | null
  breathing_disturbance_index: number | null
}

export interface OuraDailyStress {
  id: string
  day: string
  stress_high: number | null // seconds in high stress
  recovery_high: number | null // seconds in recovery
  day_summary: "restored" | "normal" | "strained" | null
}

export interface OuraDailyResilience {
  id: string
  day: string
  level: "limited" | "adequate" | "solid" | "strong" | "exceptional" | null
  contributors: {
    sleep_recovery: number | null
    daytime_recovery: number | null
    stress: number | null
  } | null
}

export interface OuraVo2Max {
  id: string
  day: string
  vo2_max: number | null
}

export interface OuraSummary {
  sleep: OuraDailySleep | null
  sleepPeriod: OuraSleepPeriod | null
  activity: OuraDailyActivity | null
  readiness: OuraDailyReadiness | null
  restingHeartRate: number | null
  heartRateReadings: OuraHeartRate[]
  spo2: OuraDailySpo2 | null
  stress: OuraDailyStress | null
  resilience: OuraDailyResilience | null
  vo2Max: number | null
}

async function ouraFetch<T>(
  endpoint: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T | null> {
  const url = new URL(`${OURA_API_BASE}/${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)")
    console.error(`[Oura API] ${endpoint} failed — status ${res.status}: ${body}`)
    return null
  }

  return res.json() as Promise<T>
}

/**
 * Get today's Oura summary including all available metrics.
 */
export async function getOuraDailySummary(
  accessToken: string,
  date?: string
): Promise<OuraSummary> {
  const today = date ?? new Date().toISOString().split("T")[0]

  const [
    sleepData, sleepPeriods, activityData, readinessData,
    heartRateData, spo2Data, stressData, resilienceData, vo2Data,
  ] = await Promise.all([
    ouraFetch<{ data: OuraDailySleep[] }>("daily_sleep", accessToken, {
      start_date: today,
      end_date: today,
    }),
    ouraFetch<{ data: OuraSleepPeriod[] }>("sleep", accessToken, {
      start_date: today,
      end_date: today,
    }),
    ouraFetch<{ data: OuraDailyActivity[] }>(
      "daily_activity",
      accessToken,
      { start_date: today, end_date: today }
    ),
    ouraFetch<{ data: OuraDailyReadiness[] }>(
      "daily_readiness",
      accessToken,
      { start_date: today, end_date: today }
    ),
    ouraFetch<{ data: OuraHeartRate[] }>("heartrate", accessToken, {
      start_date: today,
      end_date: today,
    }),
    ouraFetch<{ data: OuraDailySpo2[] }>("daily_spo2", accessToken, {
      start_date: today,
      end_date: today,
    }),
    ouraFetch<{ data: OuraDailyStress[] }>("daily_stress", accessToken, {
      start_date: today,
      end_date: today,
    }),
    ouraFetch<{ data: OuraDailyResilience[] }>("daily_resilience", accessToken, {
      start_date: today,
      end_date: today,
    }),
    ouraFetch<{ data: OuraVo2Max[] }>("vo2_max", accessToken, {
      start_date: today,
      end_date: today,
    }),
  ])

  // Calculate resting heart rate from the data.
  // Prefer rest/sleep readings, but fall back to all readings if none exist.
  let restingHeartRate: number | null = null
  const allReadings = heartRateData?.data ?? []
  if (allReadings.length > 0) {
    const restingReadings = allReadings.filter(
      (hr) => hr.source === "rest" || hr.source === "sleep"
    )
    const readings = restingReadings.length > 0 ? restingReadings : allReadings
    restingHeartRate = Math.round(
      readings.reduce((sum, hr) => sum + hr.bpm, 0) / readings.length
    )
  }

  // Use the primary (long_sleep) period for detailed sleep data
  const primarySleep = sleepPeriods?.data?.find((p) => p.type === "long_sleep")
    ?? sleepPeriods?.data?.[0]
    ?? null

  return {
    sleep: sleepData?.data?.[0] ?? null,
    sleepPeriod: primarySleep,
    activity: activityData?.data?.[0] ?? null,
    readiness: readinessData?.data?.[0] ?? null,
    restingHeartRate,
    heartRateReadings: allReadings,
    spo2: spo2Data?.data?.[0] ?? null,
    stress: stressData?.data?.[0] ?? null,
    resilience: resilienceData?.data?.[0] ?? null,
    vo2Max: vo2Data?.data?.[0]?.vo2_max ?? null,
  }
}

/**
 * Format seconds into hours and minutes string.
 */
export function formatSleepDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}
