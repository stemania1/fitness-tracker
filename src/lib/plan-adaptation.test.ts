import { describe, it, expect } from "vitest"
import { planSuggestion } from "./plan-adaptation"

// Plan starts Monday 2026-07-06. Week 1: Jul 6-12 (baseline weekend
// Sat Jul 11 / Sun Jul 12). Week 2: Jul 13-19. Deload: week 7.
const d = (y: number, m: number, day: number, hour = 12) =>
  new Date(y, m - 1, day, hour)

const PULL_A = "Pull A + Zone 2 finisher"
const PULL_B = "Pull B — strength"
const THIRTY = "30/30 intervals + Zone 2"

const pullupTest = { test_type: "pullup_max", tested_at: "2026-07-11" }
const cooperTest = { test_type: "cooper_run", tested_at: "2026-07-12" }
const pullALog = { name: PULL_A, started_at: "2026-07-11T13:00:00" }

// Every non-rest session of week 1 logged (Sunday is the Cooper slot).
const week1Logs = [
  { name: "VO2 Max intervals — 4×4", started_at: "2026-07-07T06:00:00" },
  { name: PULL_B, started_at: "2026-07-09T06:00:00" },
  pullALog,
]

describe("planSuggestion — test weekends", () => {
  it("flags the missed pull-up baseline first, swapping into the next strength day", () => {
    // Monday after baseline weekend, nothing logged at all.
    const s = planSuggestion(d(2026, 7, 13), [], [])!
    expect(s.kind).toBe("pullup-test")
    expect(s.detail).toContain(`Thursday's ${PULL_B}`)
    expect(s.detail).toMatch(/log test/i)
  })

  it("flags the missed Cooper test once the pull-up test is logged", () => {
    const s = planSuggestion(d(2026, 7, 13), [pullALog], [pullupTest])!
    expect(s.kind).toBe("cooper-test")
    // Next cardio slot after Monday is Tuesday's 4×4.
    expect(s.detail).toContain("on Tuesday")
    expect(s.detail).toContain("VO2 Max intervals — 4×4")
  })

  it("accepts a test logged within the grace window (early or late)", () => {
    const lateCooper = { test_type: "cooper_run", tested_at: "2026-07-14" }
    const week2Tuesday = {
      name: "VO2 Max intervals — 4×4",
      started_at: "2026-07-14T06:00:00",
    }
    const s = planSuggestion(
      d(2026, 7, 15),
      [...week1Logs, week2Tuesday],
      [pullupTest, lateCooper]
    )
    expect(s).toBeNull()
  })

  it("does not double-flag a test-week Sunday as a missed interval session", () => {
    // Both tests logged, all week-1 sessions logged, but no 30/30 workout —
    // the Cooper replaced Sunday's intervals, so nothing is missing.
    const s = planSuggestion(d(2026, 7, 13), week1Logs, [pullupTest, cooperTest])
    expect(s).toBeNull()
  })

  it("stops nagging about a test more than a week old", () => {
    // Jul 20: pullup baseline (Jul 11) is 9 days stale, cooper (Jul 12) is 8.
    const s = planSuggestion(d(2026, 7, 20), [pullALog], [])
    // Falls through to regular-miss detection instead (week 2 sessions).
    expect(s?.kind).not.toBe("pullup-test")
    expect(s?.kind).not.toBe("cooper-test")
  })
})

describe("planSuggestion — missed regular sessions", () => {
  const week1Done = [pullupTest, cooperTest]

  it("slides a missed strength day to the next rest day", () => {
    // Week 2: Pull B was Thursday Jul 16; today is Friday Jul 17 (rest day).
    const s = planSuggestion(d(2026, 7, 17), [pullALog], week1Done)!
    expect(s.kind).toBe("slide-session")
    expect(s.headline).toContain(PULL_B)
    expect(s.detail).toContain("Thursday")
    expect(s.detail).toContain("Today is a rest day")
  })

  it("counts a session logged a day late as done", () => {
    // Saturday's Pull A logged on Sunday still matches Saturday's slot.
    const sundayPullA = { name: PULL_A, started_at: "2026-07-19T14:00:00" }
    const tuesday4x4 = {
      name: "VO2 Max intervals — 4×4",
      started_at: "2026-07-14T06:00:00",
    }
    const pullB = { name: PULL_B, started_at: "2026-07-16T06:00:00" }
    const thirty = { name: THIRTY, started_at: "2026-07-19T09:00:00" }
    const s = planSuggestion(
      d(2026, 7, 20),
      [sundayPullA, tuesday4x4, pullB, thirty],
      week1Done
    )
    expect(s).toBeNull()
  })

  it("suggests only the most recent miss, not a backlog", () => {
    // Week 2: both Tuesday's 4×4 and Thursday's Pull B missed; Friday shows
    // only Pull B (most recent). Chasing a backlog is how programs die.
    const s = planSuggestion(d(2026, 7, 17), [pullALog], week1Done)!
    expect(s.headline).toContain(PULL_B)
    expect(s.headline).not.toContain("4×4")
  })

  it("returns null when everything recent is logged", () => {
    const logs = [
      ...week1Logs,
      { name: "VO2 Max intervals — 4×4", started_at: "2026-07-14T06:00:00" },
      { name: PULL_B, started_at: "2026-07-16T06:00:00" },
    ]
    const s = planSuggestion(d(2026, 7, 17), logs, week1Done)
    expect(s).toBeNull()
  })

  it("returns null outside the plan window", () => {
    expect(planSuggestion(d(2026, 7, 5), [], [])).toBeNull()
    expect(planSuggestion(d(2026, 10, 5), [], [])).toBeNull()
  })

  it("never flags today's own session as missed", () => {
    // Week 2 Tuesday morning, 4×4 not done yet — the day isn't over.
    const s = planSuggestion(d(2026, 7, 14, 6), week1Logs, week1Done)
    expect(s).toBeNull()
  })
})
