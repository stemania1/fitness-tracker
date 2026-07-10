/**
 * Oura Ring API helper.
 * Fetches sleep, activity, readiness, heart rate, SpO2, stress,
 * resilience, and VO2 max data.
 */

const OURA_API_BASE = "https://api.ouraring.com/v2/usercollection"

/** Shift a YYYY-MM-DD date string by whole days (UTC-safe). */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The daily_sleep document contains ONLY the score and contributor
 * sub-scores (0-100 each) — no durations. Durations live on sleep
 * periods (OuraSleepPeriod, from the /sleep endpoint).
 */
export interface OuraDailySleep {
  id: string
  day: string
  score: number | null
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

/** A single ring_battery_level sample. */
export interface OuraRingBattery {
  /** Battery percentage, 0-100. */
  level: number | null
  charging: boolean | null
  in_charger: boolean | null
  /** ISO timestamp of the sample. */
  timestamp: string
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
  /** Most recent ring battery reading, or null if unavailable. */
  ringBattery: OuraRingBattery | null
}

/**
 * Pick the most recent battery sample from a ring_battery_level response.
 * Tolerates both list (`{data: [...]}`) and single-object shapes, and an
 * empty/absent response (returns null). Exported for testing.
 */
export function latestBatterySample(
  raw: { data?: OuraRingBattery[] } | OuraRingBattery | null
): OuraRingBattery | null {
  if (!raw) return null
  const samples: OuraRingBattery[] = Array.isArray(
    (raw as { data?: OuraRingBattery[] }).data
  )
    ? (raw as { data: OuraRingBattery[] }).data
    : "level" in raw
      ? [raw as OuraRingBattery]
      : []
  const valid = samples.filter(
    (s) => s && typeof s.timestamp === "string" && s.level != null
  )
  if (valid.length === 0) return null
  return valid.reduce((latest, s) =>
    s.timestamp > latest.timestamp ? s : latest
  )
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
 * Fetch all pages of a paginated Oura endpoint, combining the `data` arrays.
 */
async function ouraFetchAll<TItem>(
  endpoint: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<TItem[]> {
  const allItems: TItem[] = []
  let nextToken: string | null = null

  do {
    const pageParams = { ...params }
    if (nextToken) pageParams.next_token = nextToken

    const page = await ouraFetch<{ data: TItem[]; next_token: string | null }>(
      endpoint,
      accessToken,
      pageParams
    )
    if (!page) break

    allItems.push(...page.data)
    nextToken = page.next_token ?? null
  } while (nextToken)

  return allItems
}

/**
 * Get today's Oura summary including all available metrics.
 */
export async function getOuraDailySummary(
  accessToken: string,
  date?: string,
  tzOffset?: string
): Promise<OuraSummary> {
  const today = date ?? new Date().toISOString().split("T")[0]

  // Build timezone-aware datetime boundaries for the heartrate endpoint.
  // The daily endpoints accept plain dates, but heartrate uses datetimes
  // and interprets them as UTC unless an offset is included.
  // tzOffset is a pre-computed string like "-04:00" or "+05:30".
  const offset = tzOffset ?? "+00:00"
  const hrStart = `${today}T00:00:00${offset}`
  const hrEnd = `${today}T23:59:59${offset}`

  // Battery samples are timestamped like heart rate; widen to a couple of
  // days so a recent reading survives even if the ring hasn't synced today.
  const batteryStart = `${shiftDate(today, -2)}T00:00:00${offset}`
  const batteryEnd = `${today}T23:59:59${offset}`

  const [
    sleepData, sleepPeriods, activityData, readinessData,
    heartRateData, spo2Data, stressData, resilienceData, vo2Data,
    batteryData,
  ] = await Promise.all([
    ouraFetch<{ data: OuraDailySleep[] }>("daily_sleep", accessToken, {
      start_date: today,
      end_date: today,
    }),
    // Sleep periods are keyed by wake-up day, but the /sleep endpoint's
    // date filtering is unreliable with a single-day window (Oura's own
    // client defaults to a two-day range). Query a padded window and pick
    // today's period client-side below.
    ouraFetch<{ data: OuraSleepPeriod[] }>("sleep", accessToken, {
      start_date: shiftDate(today, -1),
      end_date: shiftDate(today, 1),
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
    ouraFetchAll<OuraHeartRate>("heartrate", accessToken, {
      start_datetime: hrStart,
      end_datetime: hrEnd,
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
    // ring_battery_level is a newer endpoint and may not be available for
    // every token/scope — ouraFetch returns null on a non-2xx, so the
    // battery indicator simply hides rather than breaking the summary.
    ouraFetch<{ data: OuraRingBattery[] }>("ring_battery_level", accessToken, {
      start_datetime: batteryStart,
      end_datetime: batteryEnd,
    }),
  ])

  // Calculate resting heart rate from the data.
  // Prefer rest/sleep readings, but fall back to all readings if none exist.
  let restingHeartRate: number | null = null
  const allReadings = heartRateData ?? []
  if (allReadings.length > 0) {
    const restingReadings = allReadings.filter(
      (hr) => hr.source === "rest" || hr.source === "sleep"
    )
    const readings = restingReadings.length > 0 ? restingReadings : allReadings
    restingHeartRate = Math.round(
      readings.reduce((sum, hr) => sum + hr.bpm, 0) / readings.length
    )
  }

  // Use the primary (long_sleep) period for detailed sleep data. Only
  // consider periods whose wake-up day is `today` — the padded query
  // window can also return yesterday's sleep, which would be stale.
  const todaysPeriods = (sleepPeriods?.data ?? []).filter((p) => p.day === today)
  const primarySleep = todaysPeriods.find((p) => p.type === "long_sleep")
    ?? todaysPeriods[0]
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
    ringBattery: latestBatterySample(batteryData),
  }
}

export interface OuraDailyMetrics {
  day: string
  remMinutes: number | null
  remFraction: number | null
  totalSleepMinutes: number | null
  stressHighSeconds: number | null
  activityScore: number | null
  highActivityMinutes: number | null
  readinessScore: number | null
  averageHrv: number | null
}

/** Shift a YYYY-MM-DD date string by whole days (UTC-safe). */
function dayKey(day: string): string {
  return day.slice(0, 10)
}

/**
 * Fetch a window of daily sleep/stress/activity/readiness metrics and merge
 * them by wake-up day for correlation analysis. Previous-day activity is
 * lagged onto each night, so a night's REM lines up with the activity that
 * preceded it. Nights with no sleep record are omitted.
 */
export async function getOuraMetricsHistory(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<OuraDailyMetrics[]> {
  // Pull activity from one day earlier so the first night has a prior day.
  const activityStart = shiftDate(startDate, -1)

  const [sleepPeriods, activity, stress, readiness] = await Promise.all([
    ouraFetchAll<OuraSleepPeriod>("sleep", accessToken, {
      start_date: startDate,
      end_date: endDate,
    }),
    ouraFetchAll<OuraDailyActivity>("daily_activity", accessToken, {
      start_date: activityStart,
      end_date: endDate,
    }),
    ouraFetchAll<OuraDailyStress>("daily_stress", accessToken, {
      start_date: startDate,
      end_date: endDate,
    }),
    ouraFetchAll<OuraDailyReadiness>("daily_readiness", accessToken, {
      start_date: startDate,
      end_date: endDate,
    }),
  ])

  const activityByDay = new Map<string, OuraDailyActivity>()
  for (const a of activity) activityByDay.set(dayKey(a.day), a)
  const stressByDay = new Map<string, OuraDailyStress>()
  for (const s of stress) stressByDay.set(dayKey(s.day), s)
  const readinessByDay = new Map<string, OuraDailyReadiness>()
  for (const r of readiness) readinessByDay.set(dayKey(r.day), r)

  // Prefer the main long_sleep period per day; fall back to the first.
  const sleepByDay = new Map<string, OuraSleepPeriod>()
  for (const p of sleepPeriods) {
    const key = dayKey(p.day)
    const existing = sleepByDay.get(key)
    if (!existing || (p.type === "long_sleep" && existing.type !== "long_sleep")) {
      sleepByDay.set(key, p)
    }
  }

  const out: OuraDailyMetrics[] = []
  for (const [day, sleep] of [...sleepByDay.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const totalSec = sleep.total_sleep_duration
    const remSec = sleep.rem_sleep_duration
    const prevDay = shiftDate(day, -1)
    const prevActivity = activityByDay.get(prevDay)
    const stressToday = stressByDay.get(day)
    const readinessToday = readinessByDay.get(day)

    out.push({
      day,
      remMinutes: remSec != null ? Math.round(remSec / 60) : null,
      remFraction:
        remSec != null && totalSec != null && totalSec > 0
          ? remSec / totalSec
          : null,
      totalSleepMinutes: totalSec != null ? Math.round(totalSec / 60) : null,
      stressHighSeconds: stressToday?.stress_high ?? null,
      activityScore: prevActivity?.score ?? null,
      highActivityMinutes:
        prevActivity?.high_activity_time != null
          ? Math.round(prevActivity.high_activity_time / 60)
          : null,
      readinessScore: readinessToday?.score ?? null,
      averageHrv: sleep.average_hrv ?? null,
    })
  }

  return out
}

/**
 * Fetch the user's Oura VO2 Max estimates for a date range (inclusive),
 * oldest first, skipping days where Oura produced no estimate.
 */
export async function getOuraVo2MaxHistory(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<OuraVo2Max[]> {
  const items = await ouraFetchAll<OuraVo2Max>("vo2_max", accessToken, {
    start_date: startDate,
    end_date: endDate,
  })
  return items
    .filter((item) => item.vo2_max != null)
    .sort((a, b) => a.day.localeCompare(b.day))
}

/**
 * Format seconds into hours and minutes string.
 */
export function formatSleepDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}
