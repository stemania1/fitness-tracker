import { describe, it, expect } from "vitest"
import {
  mergeOuraDaily,
  type OuraDailySleep,
  type OuraSleepPeriod,
  type OuraDailyReadiness,
} from "./oura"

function sleep(day: string, score: number | null): OuraDailySleep {
  return { id: day, day, score }
}
function period(
  day: string,
  totalSec: number | null,
  hrv: number | null = null,
  type: OuraSleepPeriod["type"] = "long_sleep"
): OuraSleepPeriod {
  return {
    id: day,
    day,
    type,
    total_sleep_duration: totalSec,
    deep_sleep_duration: null,
    rem_sleep_duration: null,
    light_sleep_duration: null,
    time_in_bed: null,
    efficiency: null,
    average_heart_rate: null,
    lowest_heart_rate: null,
    average_hrv: hrv,
  }
}
function readiness(day: string, score: number | null): OuraDailyReadiness {
  return {
    id: day,
    day,
    score,
    temperature_deviation: null,
    contributors: {
      activity_balance: null,
      body_temperature: null,
      hrv_balance: null,
      previous_day_activity: null,
      previous_night: null,
      recovery_index: null,
      resting_heart_rate: null,
      sleep_balance: null,
    },
  }
}

describe("mergeOuraDaily", () => {
  it("combines sleep score, duration, hrv, and readiness per day", () => {
    const out = mergeOuraDaily(
      [sleep("2026-07-25", 80)],
      [period("2026-07-25", 7 * 3600 + 30 * 60, 55)], // 7h30m
      [readiness("2026-07-25", 72)]
    )
    expect(out).toEqual([
      {
        day: "2026-07-25",
        sleepScore: 80,
        sleepMinutes: 450,
        readinessScore: 72,
        averageHrv: 55,
      },
    ])
  })

  it("keeps the longest main sleep when a day has several periods", () => {
    const out = mergeOuraDaily(
      [],
      [
        period("2026-07-25", 3600, null, "sleep"), // 1h
        period("2026-07-25", 6 * 3600, null, "long_sleep"), // 6h — wins
        period("2026-07-25", 1800, null, "late_nap"), // ignored type
      ],
      []
    )
    expect(out[0].sleepMinutes).toBe(360)
  })

  it("sorts by day and drops days with no useful metric", () => {
    const out = mergeOuraDaily(
      [sleep("2026-07-26", 90), sleep("2026-07-24", null)],
      [],
      [readiness("2026-07-25", 60)]
    )
    // 07-24 has only a null sleep score → dropped; the rest sorted ascending.
    expect(out.map((r) => r.day)).toEqual(["2026-07-25", "2026-07-26"])
  })

  it("returns empty for no data", () => {
    expect(mergeOuraDaily([], [], [])).toEqual([])
  })
})
