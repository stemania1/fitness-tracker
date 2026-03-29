/**
 * Oura Ring API helper.
 * Fetches sleep, activity, readiness, and heart rate data.
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

export interface OuraSummary {
  sleep: OuraDailySleep | null
  activity: OuraDailyActivity | null
  readiness: OuraDailyReadiness | null
  restingHeartRate: number | null
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
    next: { revalidate: 300 }, // Cache for 5 minutes
  })

  if (!res.ok) return null
  return res.json() as Promise<T>
}

/**
 * Get today's Oura summary (sleep, activity, readiness, heart rate).
 */
export async function getOuraDailySummary(
  accessToken: string,
  date?: string
): Promise<OuraSummary> {
  const today = date ?? new Date().toISOString().split("T")[0]

  const [sleepData, activityData, readinessData, heartRateData] =
    await Promise.all([
      ouraFetch<{ data: OuraDailySleep[] }>("daily_sleep", accessToken, {
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
    ])

  // Calculate average resting heart rate from the data
  let restingHeartRate: number | null = null
  if (heartRateData?.data && heartRateData.data.length > 0) {
    const restingReadings = heartRateData.data.filter(
      (hr) => hr.source === "rest" || hr.source === "sleep"
    )
    if (restingReadings.length > 0) {
      restingHeartRate = Math.round(
        restingReadings.reduce((sum, hr) => sum + hr.bpm, 0) /
          restingReadings.length
      )
    }
  }

  return {
    sleep: sleepData?.data?.[0] ?? null,
    activity: activityData?.data?.[0] ?? null,
    readiness: readinessData?.data?.[0] ?? null,
    restingHeartRate,
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
