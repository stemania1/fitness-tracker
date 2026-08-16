import { describe, it, expect } from "vitest"
import {
  parseMovementClasses,
  parseMetSamples,
  movementHours,
  totalActiveMinutes,
  moderatePlusMinutes,
  trailingIdleMinutes,
  trailingIdleFromMet,
  sittingMinutes,
  stepPace,
  activeDayFraction,
  paceTone,
  paceLabel,
  paceDetail,
  dailyTrend,
  activeMinutesPace,
  activeMinutesFrom,
  activeMinutesDetail,
  DEFAULT_ACTIVE_MINUTES_GOAL,
  hourLabel,
  formatMinutes,
  DEFAULT_STEP_GOAL,
  ACTIVE_DAY_START_HOUR,
  ACTIVE_DAY_END_HOUR,
} from "./daily-movement"

/** An Oura-shaped timestamp at a given local clock time. */
const at = (hhmm: string) => `2026-08-15T${hhmm}:00-07:00`

describe("parseMovementClasses", () => {
  it("returns nothing without classes or a timestamp", () => {
    expect(parseMovementClasses(null, at("04:00"))).toEqual([])
    expect(parseMovementClasses("333", null)).toEqual([])
    expect(parseMovementClasses("", at("04:00"))).toEqual([])
  })

  it("returns nothing when the timestamp has no parseable clock time", () => {
    expect(parseMovementClasses("333", "2026-08-15")).toEqual([])
    expect(parseMovementClasses("333", "2026-08-15T99:00:00Z")).toEqual([])
  })

  it("buckets five-minute samples into the hour they fall in", () => {
    // Twelve samples from 07:00 = exactly one hour, all low.
    const hours = parseMovementClasses("3".repeat(12), at("07:00"))
    expect(hours).toHaveLength(1)
    expect(hours[0]).toMatchObject({
      hour: 7,
      lowMinutes: 60,
      mediumMinutes: 0,
      highMinutes: 0,
      activeMinutes: 60,
      idleMinutes: 0,
    })
  })

  it("splits samples across the hour boundary they cross", () => {
    // Eight samples from 07:30 — six land before 08:00, two after.
    const hours = parseMovementClasses("44444444", at("07:30"))
    expect(hours.map((h) => [h.hour, h.mediumMinutes])).toEqual([
      [7, 30],
      [8, 10],
    ])
  })

  it("separates intensities and counts rest/inactive as idle", () => {
    const hours = parseMovementClasses("112345", at("09:00"))
    expect(hours[0]).toMatchObject({
      hour: 9,
      // "1" rest, "1" rest, "2" inactive → 15 idle
      idleMinutes: 15,
      lowMinutes: 5,
      mediumMinutes: 5,
      highMinutes: 5,
      activeMinutes: 15,
    })
  })

  it("counts non-wear toward neither active nor idle", () => {
    const hours = parseMovementClasses("000000000000", at("11:00"))
    expect(hours[0]).toMatchObject({
      hour: 11,
      activeMinutes: 0,
      idleMinutes: 0,
    })
  })

  it("ignores digits outside the known class range", () => {
    const hours = parseMovementClasses("39x3", at("06:00"))
    expect(hours[0].lowMinutes).toBe(10)
  })

  it("fills gap hours so the series is contiguous", () => {
    // One sample at 05:00, then nothing until 08:00.
    const classes = "3" + "0".repeat(35) + "3"
    const hours = parseMovementClasses(classes, at("05:00"))
    expect(hours.map((h) => h.hour)).toEqual([5, 6, 7, 8])
    expect(hours[1].activeMinutes).toBe(0)
    expect(hours[3].lowMinutes).toBe(5)
  })

  it("stops at midnight rather than wrapping into the next day", () => {
    // Six samples from 23:45 — only three fit before midnight.
    const hours = parseMovementClasses("555555", at("23:45"))
    expect(hours).toHaveLength(1)
    expect(hours[0]).toMatchObject({ hour: 23, highMinutes: 15 })
  })

  it("reads the clock from the timestamp's own offset, not the runtime zone", () => {
    // Same instant, different stamped offsets → different local hours.
    const utc = parseMovementClasses("3", "2026-08-15T14:00:00+00:00")
    const pacific = parseMovementClasses("3", "2026-08-15T07:00:00-07:00")
    expect(utc[0].hour).toBe(14)
    expect(pacific[0].hour).toBe(7)
  })
})

describe("parseMetSamples", () => {
  const met = (items: (number | null)[], hhmm = "07:00", interval = 60) => ({
    interval,
    items,
    timestamp: at(hhmm),
  })

  it("returns nothing for unusable input", () => {
    expect(parseMetSamples(null)).toEqual([])
    expect(parseMetSamples(undefined)).toEqual([])
    expect(parseMetSamples(met([]))).toEqual([])
    expect(parseMetSamples({ interval: 60, items: [3], timestamp: "" })).toEqual([])
    // A non-positive interval would divide the day by zero.
    expect(parseMetSamples(met([3], "07:00", 0))).toEqual([])
  })

  it("cuts samples at the standard MET thresholds", () => {
    // sedentary, light, moderate, vigorous — one minute each.
    const hours = parseMetSamples(met([1.0, 2.0, 4.0, 8.0]))
    expect(hours[0]).toMatchObject({
      hour: 7,
      idleMinutes: 1,
      lowMinutes: 1,
      mediumMinutes: 1,
      highMinutes: 1,
      activeMinutes: 3,
    })
  })

  it("puts the boundary values in the higher band", () => {
    const hours = parseMetSamples(met([1.5, 3, 6]))
    expect(hours[0]).toMatchObject({
      idleMinutes: 0,
      lowMinutes: 1,
      mediumMinutes: 1,
      highMinutes: 1,
    })
  })

  it("counts a null sample as non-wear, not as sitting", () => {
    const hours = parseMetSamples(met([null, null, 1.0]))
    expect(hours[0]).toMatchObject({ idleMinutes: 1, activeMinutes: 0 })
  })

  it("ignores a non-finite sample", () => {
    const hours = parseMetSamples(met([Number.NaN, 4.0]))
    expect(hours[0].mediumMinutes).toBe(1)
  })

  it("spreads a minute-resolution series across the right hours", () => {
    // 90 moderate minutes from 07:00 → 60 in hour 7, 30 in hour 8.
    const hours = parseMetSamples(met(Array(90).fill(4.0)))
    expect(hours.map((h) => [h.hour, h.mediumMinutes])).toEqual([
      [7, 60],
      [8, 30],
    ])
  })

  it("honors a non-60-second interval", () => {
    // 30-second samples: two of them make one minute.
    const hours = parseMetSamples(met([4.0, 4.0], "07:00", 30))
    expect(hours[0].mediumMinutes).toBe(1)
  })

  it("stops at midnight rather than wrapping", () => {
    const hours = parseMetSamples(met(Array(30).fill(4.0), "23:45"))
    expect(hours).toHaveLength(1)
    expect(hours[0]).toMatchObject({ hour: 23, mediumMinutes: 15 })
  })

  it("reads the clock from the timestamp's own offset", () => {
    const utc = parseMetSamples({
      interval: 60,
      items: [4],
      timestamp: "2026-08-15T14:00:00+00:00",
    })
    expect(utc[0].hour).toBe(14)
  })
})

describe("movementHours", () => {
  const classes = "3".repeat(12)

  it("prefers per-minute MET when it is present", () => {
    const hours = movementHours({
      met: { interval: 60, items: [8.0], timestamp: at("07:00") },
      class_5_min: classes,
      timestamp: at("07:00"),
    })
    // MET says one vigorous minute; the classes would have said 60 light.
    expect(hours[0]).toMatchObject({ highMinutes: 1, lowMinutes: 0 })
  })

  it("falls back to five-minute classes when MET is missing", () => {
    const hours = movementHours({
      met: null,
      class_5_min: classes,
      timestamp: at("07:00"),
    })
    expect(hours[0].lowMinutes).toBe(60)
  })

  it("falls back when MET is present but unusable", () => {
    const hours = movementHours({
      met: { interval: 60, items: [], timestamp: at("07:00") },
      class_5_min: classes,
      timestamp: at("07:00"),
    })
    expect(hours[0].lowMinutes).toBe(60)
  })

  it("returns nothing when neither source is available", () => {
    expect(movementHours({ met: null, class_5_min: null })).toEqual([])
    expect(movementHours(null)).toEqual([])
  })
})

describe("moderatePlusMinutes", () => {
  it("counts only the top two bands", () => {
    const hours = parseMetSamples({
      interval: 60,
      items: [1.0, 2.0, 4.0, 8.0],
      timestamp: at("07:00"),
    })
    // 1 moderate + 1 vigorous; the light and sedentary minutes don't count.
    expect(moderatePlusMinutes(hours)).toBe(2)
    expect(totalActiveMinutes(hours)).toBe(3)
  })

  it("is zero for an empty series", () => {
    expect(moderatePlusMinutes([])).toBe(0)
  })
})

describe("trailingIdleFromMet / sittingMinutes", () => {
  it("counts the unbroken sub-1.5 MET run at the end", () => {
    expect(
      trailingIdleFromMet({
        interval: 60,
        items: [4.0, 1.1, 1.0, 1.2],
        timestamp: at("09:00"),
      })
    ).toBe(3)
  })

  it("is zero when the day ends on movement", () => {
    expect(
      trailingIdleFromMet({
        interval: 60,
        items: [1.0, 1.0, 4.0],
        timestamp: at("09:00"),
      })
    ).toBe(0)
  })

  it("stops at a non-wear sample rather than counting it as sitting", () => {
    expect(
      trailingIdleFromMet({
        interval: 60,
        items: [1.0, null, 1.0, 1.0],
        timestamp: at("09:00"),
      })
    ).toBe(2)
  })

  it("handles unusable input", () => {
    expect(trailingIdleFromMet(null)).toBe(0)
    expect(
      trailingIdleFromMet({ interval: 0, items: [1], timestamp: at("09:00") })
    ).toBe(0)
  })

  it("prefers MET over classes, and falls back when it is absent", () => {
    const met = { interval: 60, items: [1.0, 1.0], timestamp: at("09:00") }
    expect(sittingMinutes({ met, class_5_min: "22222222" })).toBe(2)
    expect(sittingMinutes({ met: null, class_5_min: "22222222" })).toBe(40)
    expect(sittingMinutes(null)).toBe(0)
  })
})

describe("totalActiveMinutes", () => {
  it("sums active minutes across hours", () => {
    const hours = parseMovementClasses("3".repeat(12) + "4".repeat(12), at("07:00"))
    expect(totalActiveMinutes(hours)).toBe(120)
  })

  it("is zero for an empty day", () => {
    expect(totalActiveMinutes([])).toBe(0)
  })
})

describe("trailingIdleMinutes", () => {
  it("counts the unbroken sitting run at the end", () => {
    expect(trailingIdleMinutes("3332222")).toBe(20)
  })

  it("is zero when the day ends on movement", () => {
    expect(trailingIdleMinutes("2223")).toBe(0)
  })

  it("stops at a non-wear sample rather than counting it as sitting", () => {
    expect(trailingIdleMinutes("2220222")).toBe(15)
  })

  it("handles empty input", () => {
    expect(trailingIdleMinutes(null)).toBe(0)
    expect(trailingIdleMinutes("")).toBe(0)
  })
})

describe("activeDayFraction", () => {
  it("is zero before the moving day starts", () => {
    expect(activeDayFraction(3)).toBe(0)
    expect(activeDayFraction(ACTIVE_DAY_START_HOUR)).toBe(0)
  })

  it("is one after it ends", () => {
    expect(activeDayFraction(ACTIVE_DAY_END_HOUR)).toBe(1)
    expect(activeDayFraction(23, 30)).toBe(1)
  })

  it("is half at the midpoint", () => {
    // 07:00 → 22:00 is 15 hours; the midpoint is 14:30.
    expect(activeDayFraction(14, 30)).toBeCloseTo(0.5, 5)
  })

  it("accounts for minutes", () => {
    expect(activeDayFraction(7, 30)).toBeGreaterThan(0)
    expect(activeDayFraction(7, 30)).toBeLessThan(activeDayFraction(8))
  })
})

describe("stepPace", () => {
  it("reports the goal met once the target is reached", () => {
    const p = stepPace(8200, 8000, 15)
    expect(p.status).toBe("goal-met")
    expect(p.remaining).toBe(0)
    expect(p.percent).toBe(100)
  })

  it("caps the progress percent at 100", () => {
    expect(stepPace(20000, 8000, 20).percent).toBe(100)
  })

  it("calls a total on schedule on-track", () => {
    // Midpoint of the moving day → 4,000 of an 8,000 goal is exactly on time.
    const p = stepPace(4000, 8000, 14, 30)
    expect(p.expected).toBe(4000)
    expect(p.delta).toBe(0)
    expect(p.status).toBe("on-track")
  })

  it("flags a total well under schedule as behind", () => {
    const p = stepPace(1000, 8000, 14, 30)
    expect(p.status).toBe("behind")
    expect(p.delta).toBe(-3000)
    expect(p.remaining).toBe(7000)
  })

  it("flags a total well over schedule as ahead", () => {
    const p = stepPace(6000, 8000, 14, 30)
    expect(p.status).toBe("ahead")
    expect(p.delta).toBe(2000)
  })

  it("stays on-track inside the tolerance band", () => {
    // 5% off an 8,000 goal is within the 10% band.
    expect(stepPace(4400, 8000, 14, 30).status).toBe("on-track")
    expect(stepPace(3600, 8000, 14, 30).status).toBe("on-track")
  })

  it("does not call an early-morning total ahead of pace", () => {
    const p = stepPace(300, 8000, 5)
    expect(p.expected).toBe(0)
    expect(p.status).toBe("on-track")
    expect(p.projected).toBeNull()
  })

  it("projects the end-of-day total from the current rate", () => {
    // Halfway through the moving day with 3,000 steps → 6,000 projected.
    expect(stepPace(3000, 8000, 14, 30).projected).toBe(6000)
  })

  it("falls back to the default goal when the stored goal is unusable", () => {
    expect(stepPace(1000, 0, 12).goal).toBe(DEFAULT_STEP_GOAL)
    expect(stepPace(1000, -5, 12).goal).toBe(DEFAULT_STEP_GOAL)
  })

  it("handles a zero-step day", () => {
    const p = stepPace(0, 8000, 20)
    expect(p.percent).toBe(0)
    expect(p.status).toBe("behind")
    expect(p.remaining).toBe(8000)
  })
})

describe("activeMinutesFrom", () => {
  const activity = (medium: number, high: number, low = 7200) => ({
    medium_activity_time: medium,
    high_activity_time: high,
    low_activity_time: low,
  })

  it("sums medium and high activity, in minutes", () => {
    // 20 min medium + 10 min high.
    expect(activeMinutesFrom(activity(1200, 600))).toBe(30)
  })

  it("excludes the low band entirely", () => {
    // Two hours of pottering, no real effort — this must not read as active.
    expect(activeMinutesFrom(activity(0, 0, 7200))).toBe(0)
  })

  it("treats missing fields as zero", () => {
    expect(activeMinutesFrom({})).toBe(0)
    expect(
      activeMinutesFrom({ medium_activity_time: null, high_activity_time: 300 })
    ).toBe(5)
  })

  it("is zero for no activity document", () => {
    expect(activeMinutesFrom(null)).toBe(0)
  })

  it("rounds to the nearest minute", () => {
    expect(activeMinutesFrom(activity(100, 0))).toBe(2) // 1m40s
  })

  it("counts from per-minute MET when it is available", () => {
    // Oura's own totals say 20 minutes; MET says 3. MET wins — it is the
    // finer measurement and the one the chart is drawn from.
    expect(
      activeMinutesFrom({
        ...activity(1200, 0),
        met: {
          interval: 60,
          items: [1.0, 2.0, 4.0, 4.0, 8.0],
          timestamp: "2026-08-15T07:00:00-07:00",
        },
      })
    ).toBe(3)
  })

  it("falls back to Oura's totals when MET is unusable", () => {
    expect(
      activeMinutesFrom({
        ...activity(1200, 600),
        met: { interval: 60, items: [], timestamp: "2026-08-15T07:00:00-07:00" },
      })
    ).toBe(30)
  })

  it("does not count light MET minutes toward the goal", () => {
    // A whole hour of pottering at MET 2 — real movement, but not moderate.
    expect(
      activeMinutesFrom({
        ...activity(0, 0),
        met: {
          interval: 60,
          items: Array(60).fill(2.0),
          timestamp: "2026-08-15T07:00:00-07:00",
        },
      })
    ).toBe(0)
  })
})

describe("activeMinutesPace", () => {
  it("reports the goal met once the target is reached", () => {
    const p = activeMinutesPace(32, 30, 16)
    expect(p.status).toBe("goal-met")
    expect(p.remaining).toBe(0)
  })

  it("paces on the same waking-day curve as steps", () => {
    // Midpoint of the moving day → 15 of a 30-minute goal is on time.
    const p = activeMinutesPace(15, 30, 14, 30)
    expect(p.expected).toBe(15)
    expect(p.status).toBe("on-track")
  })

  it("flags a day with no real effort as behind", () => {
    const p = activeMinutesPace(0, 30, 19)
    expect(p.status).toBe("behind")
    expect(p.remaining).toBe(30)
  })

  it("falls back to the default goal when none is stored", () => {
    expect(activeMinutesPace(10, 0, 12).goal).toBe(DEFAULT_ACTIVE_MINUTES_GOAL)
  })

  it("does not call an early-morning total ahead of pace", () => {
    expect(activeMinutesPace(5, 30, 6).status).toBe("on-track")
  })
})

describe("activeMinutesDetail", () => {
  it("celebrates a cleared goal", () => {
    expect(activeMinutesDetail(activeMinutesPace(35, 30, 18))).toBe(
      "35 min of moderate+ activity — goal cleared."
    )
  })

  it("names the goal when nothing has been logged", () => {
    expect(activeMinutesDetail(activeMinutesPace(0, 30, 15))).toBe(
      "No moderate activity logged yet · 30 min goal"
    )
  })

  it("reports the shortfall and what's banked so far", () => {
    expect(activeMinutesDetail(activeMinutesPace(18, 30, 15))).toBe(
      "12 min to go · 18m so far"
    )
  })

  it("formats a long partial total in hours", () => {
    expect(activeMinutesDetail(activeMinutesPace(75, 90, 15))).toContain(
      "1h 15m so far"
    )
  })
})

describe("paceTone / paceLabel / paceDetail", () => {
  it("maps status to a chip tone", () => {
    expect(paceTone("goal-met")).toBe("progress")
    expect(paceTone("ahead")).toBe("progress")
    expect(paceTone("behind")).toBe("attention")
    expect(paceTone("on-track")).toBe("neutral")
  })

  it("labels each status", () => {
    expect(paceLabel("goal-met")).toBe("Goal met")
    expect(paceLabel("ahead")).toBe("Ahead of pace")
    expect(paceLabel("behind")).toBe("Behind pace")
    expect(paceLabel("on-track")).toBe("On pace")
  })

  it("describes a met goal without a remainder", () => {
    expect(paceDetail(stepPace(9000, 8000, 19))).toContain("goal cleared")
  })

  it("describes how far behind, in absolute steps", () => {
    const detail = paceDetail(stepPace(1000, 8000, 14, 30))
    expect(detail).toContain("3,000 behind schedule")
    expect(detail).toContain("7,000 to go")
  })

  it("describes how far ahead", () => {
    expect(paceDetail(stepPace(6000, 8000, 14, 30))).toContain(
      "2,000 ahead of schedule"
    )
  })

  it("just reports the remainder when on pace", () => {
    expect(paceDetail(stepPace(4000, 8000, 14, 30))).toBe("4,000 steps to go")
  })
})

describe("dailyTrend", () => {
  const rows = [
    { day: "2026-08-11", value: 6000 },
    { day: "2026-08-12", value: 10000 },
    { day: "2026-08-13", value: 8000 },
    { day: "2026-08-14", value: 4000 },
  ]

  it("averages the days with data", () => {
    expect(dailyTrend(rows, 8000).average).toBe(7000)
    expect(dailyTrend(rows, 8000).days).toBe(4)
  })

  it("finds the best day", () => {
    expect(dailyTrend(rows, 8000).best).toEqual({
      day: "2026-08-12",
      value: 10000,
    })
  })

  it("counts days that reached the goal", () => {
    expect(dailyTrend(rows, 8000).daysAtGoal).toBe(2)
    expect(dailyTrend(rows, 5000).daysAtGoal).toBe(3)
  })

  it("excludes today, whose total is still partial", () => {
    const t = dailyTrend(rows, 8000, "2026-08-14")
    expect(t.days).toBe(3)
    expect(t.average).toBe(8000)
  })

  it("skips days with null or zero steps", () => {
    const t = dailyTrend(
      [
        { day: "2026-08-11", value: null },
        { day: "2026-08-12", value: 0 },
        { day: "2026-08-13", value: 9000 },
      ],
      8000
    )
    expect(t.days).toBe(1)
    expect(t.average).toBe(9000)
  })

  it("returns an empty trend when nothing is usable", () => {
    expect(dailyTrend([], 8000)).toEqual({
      average: null,
      best: null,
      daysAtGoal: 0,
      days: 0,
    })
  })
})

describe("hourLabel", () => {
  it("formats the clock compactly", () => {
    expect(hourLabel(0)).toBe("12a")
    expect(hourLabel(7)).toBe("7a")
    expect(hourLabel(12)).toBe("12p")
    expect(hourLabel(18)).toBe("6p")
    expect(hourLabel(23)).toBe("11p")
  })
})

describe("formatMinutes", () => {
  it("formats minutes, hours, and both", () => {
    expect(formatMinutes(45)).toBe("45m")
    expect(formatMinutes(120)).toBe("2h")
    expect(formatMinutes(135)).toBe("2h 15m")
    expect(formatMinutes(0)).toBe("0m")
  })
})
