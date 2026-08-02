import { describe, it, expect } from "vitest"
import { auditPlanDays, matchesSession } from "./plan-audit"

// Plan starts Mon 2026-07-06. The 1 Aug revision moved VO2 to the weekend,
// so Tue 28 Jul is still the 4×4 day and Sat 8 Aug is the new one.
const at = (m: number, d: number, h = 8) =>
  ({ name: "", started_at: new Date(2026, m - 1, d, h).toISOString() })

describe("matchesSession", () => {
  const tue = new Date(2026, 6, 28)

  it("matches an identically named workout on the day", () => {
    expect(
      matchesSession(
        { ...at(7, 28), name: "VO2 Max intervals — 4×4" },
        "VO2 Max intervals — 4×4",
        tue
      )
    ).toBe(true)
  })

  it("allows a day either side", () => {
    expect(
      matchesSession(
        { ...at(7, 29), name: "VO2 Max intervals — 4×4" },
        "VO2 Max intervals — 4×4",
        tue
      )
    ).toBe(true)
  })

  it("does not match two days out", () => {
    expect(
      matchesSession(
        { ...at(7, 30), name: "VO2 Max intervals — 4×4" },
        "VO2 Max intervals — 4×4",
        tue
      )
    ).toBe(false)
  })

  it("is an exact name match — this is the trap Quick Log falls into", () => {
    // Quick Log names a workout after the exercise, not the plan session.
    expect(
      matchesSession({ ...at(7, 28), name: "Treadmill Run" }, "VO2 Max intervals — 4×4", tue)
    ).toBe(false)
  })
})

describe("auditPlanDays", () => {
  const sat = new Date(2026, 7, 1, 16)

  it("reports a matching log as done", () => {
    const rows = auditPlanDays(sat, 7, [
      { ...at(7, 28), name: "VO2 Max intervals — 4×4" },
    ])
    const tue = rows.find((r) => r.day === "2026-07-28")!
    expect(tue.verdict).toBe("done")
    expect(tue.expected).toBe("VO2 Max intervals — 4×4")
  })

  it("distinguishes a name mismatch from a genuinely missing session", () => {
    const rows = auditPlanDays(sat, 7, [{ ...at(7, 28), name: "Treadmill Run" }])
    const tue = rows.find((r) => r.day === "2026-07-28")!
    // The row exists — the detector just won't match it.
    expect(tue.verdict).toBe("name-mismatch")
    expect(tue.logged.map((l) => l.name)).toEqual(["Treadmill Run"])

    const thu = rows.find((r) => r.day === "2026-07-30")!
    expect(thu.verdict).toBe("missing")
    expect(thu.logged).toEqual([])
  })

  it("marks rest days as rest, not missing", () => {
    const rows = auditPlanDays(sat, 7, [])
    expect(rows.find((r) => r.day === "2026-07-31")!.verdict).toBe("rest")
  })

  it("uses the schedule in force on each day, not today's", () => {
    const rows = auditPlanDays(sat, 7, [])
    // Thursday 30 July was Pull B before the 1 Aug revision.
    expect(rows.find((r) => r.day === "2026-07-30")!.expected).toBe(
      "Pull B — strength"
    )
  })

  it("returns newest first and covers the requested span", () => {
    const rows = auditPlanDays(sat, 14, [])
    expect(rows).toHaveLength(14)
    expect(rows[0].day).toBe("2026-08-01")
    expect(rows[13].day).toBe("2026-07-19")
  })
})
