import { describe, it, expect } from "vitest"
import { buildOuraTrend, type OuraDailyPoint } from "./oura-trends"

function row(
  day: string,
  sleepMinutes: number | null,
  sleepScore: number | null = null,
  readinessScore: number | null = null
): OuraDailyPoint {
  return { day, sleepMinutes, sleepScore, readinessScore }
}

describe("buildOuraTrend", () => {
  it("converts sleep minutes to hours and sorts ascending", () => {
    const t = buildOuraTrend(
      [row("2026-07-02", 450), row("2026-07-01", 420)],
      "sleepHours"
    )
    expect(t.points).toEqual([
      { day: "2026-07-01", value: 7 },
      { day: "2026-07-02", value: 7.5 },
    ])
  })

  it("drops days missing the chosen metric", () => {
    const t = buildOuraTrend(
      [row("2026-07-01", null, 80), row("2026-07-02", 480, 85)],
      "sleepHours"
    )
    expect(t.points).toEqual([{ day: "2026-07-02", value: 8 }])
  })

  it("computes 7-day vs prior-7 averages and delta", () => {
    // 14 days: first 7 at 7h, next 7 at 8h.
    const rows: OuraDailyPoint[] = []
    for (let i = 0; i < 7; i++) rows.push(row(`2026-07-0${i + 1}`, 420))
    for (let i = 0; i < 7; i++) rows.push(row(`2026-07-1${i}`, 480))
    const t = buildOuraTrend(rows, "sleepHours")
    expect(t.avgPrev7).toBe(7)
    expect(t.avg7).toBe(8)
    expect(t.delta).toBe(1)
  })

  it("selects the readiness metric", () => {
    const t = buildOuraTrend(
      [row("2026-07-01", 400, 70, 65), row("2026-07-02", 400, 72, 80)],
      "readiness"
    )
    expect(t.points).toEqual([
      { day: "2026-07-01", value: 65 },
      { day: "2026-07-02", value: 80 },
    ])
  })

  it("leaves delta null without two weeks of data", () => {
    const t = buildOuraTrend([row("2026-07-01", 420)], "sleepHours")
    expect(t.avg7).toBe(7)
    expect(t.avgPrev7).toBeNull()
    expect(t.delta).toBeNull()
  })

  it("handles no data", () => {
    const t = buildOuraTrend([], "sleepScore")
    expect(t).toEqual({ points: [], avg7: null, avgPrev7: null, delta: null })
  })
})
