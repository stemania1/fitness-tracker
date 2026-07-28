import { describe, it, expect } from "vitest"
import { currentStreak, creatineProgress } from "./creatine-streak"
import { shiftDateString } from "./dates"

describe("currentStreak", () => {
  const today = "2026-07-26"

  it("counts consecutive days ending today when today is taken", () => {
    const taken = ["2026-07-24", "2026-07-25", "2026-07-26"]
    expect(currentStreak(taken, today)).toBe(3)
  })

  it("counts back from yesterday when today isn't logged yet", () => {
    // Not taken today, but a 2-day run through yesterday still stands.
    const taken = ["2026-07-24", "2026-07-25"]
    expect(currentStreak(taken, today)).toBe(2)
  })

  it("is 0 when neither today nor yesterday is taken", () => {
    const taken = ["2026-07-20", "2026-07-21"]
    expect(currentStreak(taken, today)).toBe(0)
  })

  it("stops at the first gap", () => {
    // Missing 07-24 breaks the run; only today + yesterday count.
    const taken = ["2026-07-22", "2026-07-25", "2026-07-26"]
    expect(currentStreak(taken, today)).toBe(2)
  })

  it("is 1 for a single day taken today", () => {
    expect(currentStreak([today], today)).toBe(1)
  })

  it("is 0 with no history", () => {
    expect(currentStreak([], today)).toBe(0)
  })
})

describe("creatineProgress", () => {
  it("reports partial progress toward a 10 g target", () => {
    const p = creatineProgress(5, 10)
    expect(p.totalG).toBe(5)
    expect(p.targetG).toBe(10)
    expect(p.pct).toBe(50)
    expect(p.met).toBe(false)
    expect(p.remainingG).toBe(5)
  })

  it("marks the target met and stops counting remaining", () => {
    const p = creatineProgress(10, 10)
    expect(p.met).toBe(true)
    expect(p.pct).toBe(100)
    expect(p.remainingG).toBe(0)
  })

  it("caps percent at 100 when over target", () => {
    const p = creatineProgress(15, 10)
    expect(p.pct).toBe(100)
    expect(p.met).toBe(true)
    expect(p.remainingG).toBe(0)
    // The real total is still reported.
    expect(p.totalG).toBe(15)
  })

  it("accumulates split doses (2.5 + 5 = 7.5 of 10)", () => {
    const p = creatineProgress(2.5 + 5, 10)
    expect(p.totalG).toBe(7.5)
    expect(p.remainingG).toBe(2.5)
    expect(p.met).toBe(false)
  })

  it("defaults the target to 5 g and guards non-positive targets", () => {
    expect(creatineProgress(5).met).toBe(true)
    expect(creatineProgress(5, 0).targetG).toBe(5)
    expect(creatineProgress(5, -2).targetG).toBe(5)
  })

  it("treats nothing logged as zero progress", () => {
    const p = creatineProgress(0, 10)
    expect(p.totalG).toBe(0)
    expect(p.pct).toBe(0)
    expect(p.met).toBe(false)
    expect(p.remainingG).toBe(10)
  })
})
