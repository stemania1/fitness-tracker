import { describe, it, expect } from "vitest"
import { generateInsights } from "./oura-insights"
import type { OuraSummary } from "./oura"

/** Empty/null summary; tests fill in only what they exercise. */
function emptySummary(): OuraSummary {
  return {
    sleep: null,
    sleepPeriod: null,
    activity: null,
    readiness: null,
    restingHeartRate: null,
    heartRateReadings: [],
    spo2: null,
    stress: null,
    resilience: null,
    vo2Max: null,
    ringBattery: null,
  }
}

describe("generateInsights — workout/readiness", () => {
  it("returns 'great day' insight for high readiness + restored stress", () => {
    const s = emptySummary()
    s.readiness = {
      id: "r1",
      day: "2024-01-01",
      score: 90,
      temperature_deviation: 0,
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
    s.stress = {
      id: "st1",
      day: "2024-01-01",
      stress_high: null,
      recovery_high: 3600,
      day_summary: "restored",
    }
    const result = generateInsights(s)
    const workout = result.find((i) => i.type === "workout")
    expect(workout).toBeDefined()
    expect(workout!.priority).toBe("high")
    expect(workout!.title).toMatch(/hard workout/i)
    expect(workout!.icon).toBe("dumbbell")
  })

  it("recommends moderate workout for readiness in [70, 84]", () => {
    const s = emptySummary()
    s.readiness = {
      id: "r1",
      day: "2024-01-01",
      score: 75,
      temperature_deviation: 0,
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
    const workout = generateInsights(s).find((i) => i.type === "workout")
    expect(workout?.title).toMatch(/moderate workout/i)
    expect(workout?.priority).toBe("medium")
  })

  it("recommends light/rest when readiness < 70", () => {
    const s = emptySummary()
    s.readiness = {
      id: "r1",
      day: "2024-01-01",
      score: 60,
      temperature_deviation: 0,
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
    const workout = generateInsights(s).find((i) => i.type === "workout")
    expect(workout?.title).toMatch(/light day or rest/i)
    expect(workout?.priority).toBe("high")
    expect(workout?.icon).toBe("zap")
  })

  it("emits no workout insight when readiness is null", () => {
    const result = generateInsights(emptySummary())
    expect(result.find((i) => i.type === "workout")).toBeUndefined()
  })
})

describe("generateInsights — sleep", () => {
  it("flags poor sleep with HRV detail when both are low", () => {
    const s = emptySummary()
    s.sleep = { id: "s1", day: "2024-01-01", score: 50 }
    s.sleepPeriod = {
      id: "sp1",
      day: "2024-01-01",
      type: "long_sleep",
      total_sleep_duration: 5 * 3600,
      deep_sleep_duration: 60 * 60,
      rem_sleep_duration: 60 * 60,
      light_sleep_duration: 3 * 3600,
      time_in_bed: 6 * 3600,
      efficiency: 80,
      average_heart_rate: 60,
      lowest_heart_rate: 50,
      average_hrv: 25, // low
    }
    const sleep = generateInsights(s).find((i) => i.type === "sleep")
    expect(sleep?.title).toMatch(/poor sleep/i)
    expect(sleep?.priority).toBe("high")
    expect(sleep?.body).toMatch(/HRV/)
    expect(sleep?.body).toMatch(/5h/) // formatted duration
  })

  it("celebrates excellent sleep when score >= 85", () => {
    const s = emptySummary()
    s.sleep = { id: "s1", day: "2024-01-01", score: 90 }
    const sleep = generateInsights(s).find((i) => i.type === "sleep")
    expect(sleep?.title).toMatch(/excellent sleep/i)
    expect(sleep?.priority).toBe("low")
  })

  it("flags low deep sleep percentage when score is in the middle band", () => {
    const s = emptySummary()
    const total = 8 * 3600
    s.sleep = { id: "s1", day: "2024-01-01", score: 75 } // not poor, not excellent
    s.sleepPeriod = {
      id: "sp1",
      day: "2024-01-01",
      type: "long_sleep",
      total_sleep_duration: total,
      deep_sleep_duration: Math.floor(total * 0.1), // 10% — below 15% threshold
      rem_sleep_duration: Math.floor(total * 0.25),
      light_sleep_duration: Math.floor(total * 0.65),
      time_in_bed: total,
      efficiency: 90,
      average_heart_rate: 60,
      lowest_heart_rate: 50,
      average_hrv: 45,
    }
    const sleep = generateInsights(s).find((i) => i.type === "sleep")
    expect(sleep?.title).toMatch(/low deep sleep/i)
    expect(sleep?.priority).toBe("medium")
  })

  it("emits no sleep insight when there is no sleep data", () => {
    const result = generateInsights(emptySummary())
    expect(result.find((i) => i.type === "sleep")).toBeUndefined()
  })
})

describe("generateInsights — stress / recovery", () => {
  it("warns when stress day_summary is 'strained'", () => {
    const s = emptySummary()
    s.stress = {
      id: "st1",
      day: "2024-01-01",
      stress_high: 90 * 60, // 90 minutes
      recovery_high: null,
      day_summary: "strained",
    }
    const recovery = generateInsights(s).find(
      (i) => i.type === "recovery" && i.title.match(/high stress/i)
    )
    expect(recovery?.priority).toBe("high")
    expect(recovery?.body).toMatch(/90min/)
  })

  it("celebrates 'restored' stress", () => {
    const s = emptySummary()
    s.stress = {
      id: "st1",
      day: "2024-01-01",
      stress_high: null,
      recovery_high: 30 * 60,
      day_summary: "restored",
    }
    const recovery = generateInsights(s).find((i) =>
      i.title.match(/well recovered/i)
    )
    expect(recovery?.priority).toBe("low")
  })
})

describe("generateInsights — health thresholds", () => {
  it("warns on temperature deviation > 1.0", () => {
    const s = emptySummary()
    s.readiness = {
      id: "r1",
      day: "2024-01-01",
      score: 80,
      temperature_deviation: 1.5,
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
    const tempInsight = generateInsights(s).find((i) =>
      i.title.match(/temperature/i)
    )
    expect(tempInsight?.priority).toBe("high")
    expect(tempInsight?.body).toMatch(/\+1\.5/)
  })

  it("does NOT warn on temperature deviation within ±1.0", () => {
    const s = emptySummary()
    s.readiness = {
      id: "r1",
      day: "2024-01-01",
      score: 80,
      temperature_deviation: 0.8,
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
    const tempInsight = generateInsights(s).find((i) =>
      i.title.match(/temperature/i)
    )
    expect(tempInsight).toBeUndefined()
  })

  it("warns on SpO2 < 95", () => {
    const s = emptySummary()
    s.spo2 = {
      id: "sp1",
      day: "2024-01-01",
      spo2_percentage: { average: 93 },
      breathing_disturbance_index: null,
    }
    const spo2 = generateInsights(s).find((i) =>
      i.title.match(/blood oxygen/i)
    )
    expect(spo2?.priority).toBe("high")
  })

  it("does NOT warn on SpO2 = 95", () => {
    const s = emptySummary()
    s.spo2 = {
      id: "sp1",
      day: "2024-01-01",
      spo2_percentage: { average: 95 },
      breathing_disturbance_index: null,
    }
    const spo2 = generateInsights(s).find((i) =>
      i.title.match(/blood oxygen/i)
    )
    expect(spo2).toBeUndefined()
  })
})

describe("generateInsights — activity", () => {
  function withActivity(steps: number): OuraSummary {
    const s = emptySummary()
    s.activity = {
      id: "a1",
      day: "2024-01-01",
      score: 70,
      active_calories: 200,
      total_calories: 2000,
      steps,
      equivalent_walking_distance: 2000,
      high_activity_time: 0,
      medium_activity_time: 0,
      low_activity_time: 0,
    }
    return s
  }

  it("nudges on low step count (<3000)", () => {
    const a = generateInsights(withActivity(1500)).find(
      (i) => i.type === "activity"
    )
    expect(a?.title).toMatch(/low movement/i)
    expect(a?.priority).toBe("medium")
  })

  it("celebrates high step count (>=10000)", () => {
    const a = generateInsights(withActivity(12000)).find(
      (i) => i.type === "activity"
    )
    expect(a?.title).toMatch(/great step count/i)
    expect(a?.priority).toBe("low")
  })

  it("stays silent for middling step counts", () => {
    const a = generateInsights(withActivity(6000)).find(
      (i) => i.type === "activity"
    )
    expect(a).toBeUndefined()
  })
})

describe("generateInsights — resilience and VO2 max", () => {
  it("warns when resilience is limited", () => {
    const s = emptySummary()
    s.resilience = {
      id: "res1",
      day: "2024-01-01",
      level: "limited",
      contributors: null,
    }
    const r = generateInsights(s).find((i) =>
      i.title.match(/resilience is limited/i)
    )
    expect(r?.priority).toBe("medium")
  })

  it("celebrates strong/exceptional resilience", () => {
    const s = emptySummary()
    s.resilience = {
      id: "res1",
      day: "2024-01-01",
      level: "exceptional",
      contributors: null,
    }
    const r = generateInsights(s).find((i) =>
      i.title.match(/resilience is exceptional/i)
    )
    expect(r?.priority).toBe("low")
  })

  it("notes excellent cardio fitness when VO2 >= 50", () => {
    const s = emptySummary()
    s.vo2Max = 52.5
    const v = generateInsights(s).find((i) =>
      i.title.match(/excellent cardio/i)
    )
    expect(v?.priority).toBe("low")
  })

  it("flags room to improve when VO2 < 35", () => {
    const s = emptySummary()
    s.vo2Max = 30
    const v = generateInsights(s).find((i) =>
      i.title.match(/improve cardio/i)
    )
    expect(v?.priority).toBe("medium")
  })

  it("emits no VO2 insight in the mid range", () => {
    const s = emptySummary()
    s.vo2Max = 42
    const v = generateInsights(s).find((i) => i.body.match(/VO2 Max/))
    expect(v).toBeUndefined()
  })
})

describe("generateInsights — age-aware personalization", () => {
  function withReadiness(score: number) {
    const s = emptySummary()
    s.readiness = {
      id: "r1",
      day: "2024-01-01",
      score,
      temperature_deviation: 0,
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
    return s
  }

  it("adds a Zone 2-3 bpm target to the moderate recommendation when age is known", () => {
    const workout = generateInsights(withReadiness(75), { age: 51 }).find(
      (i) => i.type === "workout"
    )
    // Age 51 → max HR 172; Zone 2-3 = 103-138 bpm
    expect(workout?.body).toContain("103-138 bpm")
    expect(workout?.body).toMatch(/Zone 2-3 for your age/)
  })

  it("adds a Zone 4-5 range and est. max HR to the hard recommendation", () => {
    const s = withReadiness(90)
    s.stress = {
      id: "st1",
      day: "2024-01-01",
      stress_high: null,
      recovery_high: 3600,
      day_summary: "restored",
    }
    const workout = generateInsights(s, { age: 51 }).find((i) => i.type === "workout")
    expect(workout?.body).toContain("138-172 bpm")
    expect(workout?.body).toContain("est. max 172")
  })

  it("adds a Zone 2 ceiling to the light-day recommendation", () => {
    const workout = generateInsights(withReadiness(55), { age: 51 }).find(
      (i) => i.type === "workout"
    )
    expect(workout?.body).toContain("stay under 120 bpm")
  })

  it("keeps the generic wording when no profile is provided", () => {
    const workout = generateInsights(withReadiness(75)).find(
      (i) => i.type === "workout"
    )
    expect(workout?.body).not.toMatch(/bpm/)
    expect(workout?.body).toMatch(/Save the PRs/)
  })

  it("keeps the generic wording when age is implausible", () => {
    const workout = generateInsights(withReadiness(75), { age: 400 }).find(
      (i) => i.type === "workout"
    )
    expect(workout?.body).not.toMatch(/bpm/)
  })

  it("rates VO2 max against the user's age/sex bracket", () => {
    const s = emptySummary()
    s.vo2Max = 43
    // 43 is mid-range on absolute cutoffs, but excellent for a 51yo male.
    const v = generateInsights(s, { age: 51, sex: "male" }).find((i) =>
      i.title.match(/excellent cardio/i)
    )
    expect(v).toBeDefined()
    expect(v?.body).toMatch(/for your age/)
  })

  it("does not flag a 51-year-old male's VO2 of 36 as low (it would be under absolute cutoffs)", () => {
    const s = emptySummary()
    s.vo2Max = 36
    const v = generateInsights(s, { age: 51, sex: "male" }).find((i) =>
      i.body.match(/VO2 Max/)
    )
    expect(v).toBeUndefined()
  })
})

describe("generateInsights — overall behavior", () => {
  it("returns at most 4 insights, sorted high→low priority", () => {
    // Force many insights to trigger the cap.
    const s = emptySummary()
    s.readiness = {
      id: "r1",
      day: "2024-01-01",
      score: 90,
      temperature_deviation: 1.5, // high
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
    s.stress = {
      id: "st1",
      day: "2024-01-01",
      stress_high: null,
      recovery_high: 1800,
      day_summary: "restored",
    }
    s.spo2 = {
      id: "sp1",
      day: "2024-01-01",
      spo2_percentage: { average: 93 }, // high
      breathing_disturbance_index: null,
    }
    s.sleep = { id: "s1", day: "2024-01-01", score: 90 } // low priority
    s.activity = {
      id: "a1",
      day: "2024-01-01",
      score: 80,
      active_calories: 400,
      total_calories: 2500,
      steps: 12000, // low priority
      equivalent_walking_distance: 5000,
      high_activity_time: 0,
      medium_activity_time: 0,
      low_activity_time: 0,
    }
    s.vo2Max = 52 // low priority

    const result = generateInsights(s)
    expect(result.length).toBe(4)

    // Priority order must be non-decreasing.
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
    for (let i = 1; i < result.length; i++) {
      expect(order[result[i].priority]).toBeGreaterThanOrEqual(
        order[result[i - 1].priority]
      )
    }
    // High-priority items should come first when present.
    expect(result[0].priority).toBe("high")
  })

  it("returns [] when every metric is null", () => {
    expect(generateInsights(emptySummary())).toEqual([])
  })
})
