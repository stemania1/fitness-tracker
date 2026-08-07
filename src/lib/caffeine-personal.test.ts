import { describe, it, expect } from "vitest"
import {
  learnCaffeineModel,
  buildCaffeineCheckins,
  describeCaffeineModel,
  formatHalfLife,
  MIN_CHECKINS,
  type CaffeineCheckin,
} from "./caffeine-personal"
import { CAFFEINE_HALF_LIFE_MIN } from "./caffeine"

function onBoard(
  doses: CaffeineCheckin["doses"],
  halfLifeMin: number
): number {
  return doses.reduce(
    (s, d) => s + d.mg * Math.pow(0.5, d.minutesAgo / halfLifeMin),
    0
  )
}

/** Level 1–5 as a rounded linear read of the on-board mg at the TRUE
 *  half-life — the generative model the fit should recover. */
function levelFor(doses: CaffeineCheckin["doses"], trueHalfLife: number): number {
  return Math.max(
    1,
    Math.min(5, Math.round(1 + (4 * onBoard(doses, trueHalfLife)) / 320))
  )
}

/**
 * Evening check-ins after a 300 mg dose whose timing sweeps from 1h to ~13h
 * before, day by day, plus an occasional small top-up. A continuum of dose
 * ages is what lets the grid search discriminate: at the wrong candidate the
 * decay curve mis-shapes the on-board estimates and the correlation drops,
 * so the score peaks at the generating half-life. Six caffeine-free morning
 * check-ins supply the no-caffeine contrast group.
 */
function synthesize(trueHalfLife: number): CaffeineCheckin[] {
  const checkins: CaffeineCheckin[] = []
  for (let day = 0; day < 20; day++) {
    const doses = [{ mg: 300, minutesAgo: 60 + day * 36 }]
    if (day % 3 === 0) doses.push({ mg: 60, minutesAgo: 45 })
    checkins.push({
      hour: 20,
      doses,
      level: levelFor(doses, trueHalfLife),
    })
    if (day < 6) checkins.push({ hour: 9, doses: [], level: 1 })
  }
  return checkins
}

describe("learnCaffeineModel", () => {
  it("recovers a slow clearer from the check-in history", () => {
    const model = learnCaffeineModel(synthesize(540))
    expect(model.personalized).toBe(true)
    expect(model.halfLifeMin).toBeGreaterThanOrEqual(450)
    expect(model.sensitivity).not.toBeNull()
  })

  it("recovers a fast clearer", () => {
    const model = learnCaffeineModel(synthesize(180))
    expect(model.personalized).toBe(true)
    expect(model.halfLifeMin).toBeLessThanOrEqual(240)
  })

  it("falls back below the minimum check-in count", () => {
    const model = learnCaffeineModel(synthesize(540).slice(0, MIN_CHECKINS - 1))
    expect(model.personalized).toBe(false)
    expect(model.halfLifeMin).toBe(CAFFEINE_HALF_LIFE_MIN)
    expect(model.reason).toBe("not_enough_data")
  })

  it("falls back when every check-in is equally caffeinated (no contrast)", () => {
    const checkins: CaffeineCheckin[] = Array.from({ length: 20 }, (_, i) => ({
      hour: i % 2 === 0 ? 9 : 20,
      doses: [{ mg: 200, minutesAgo: 60 }],
      level: 3,
    }))
    const model = learnCaffeineModel(checkins)
    expect(model.personalized).toBe(false)
    expect(model.reason).toBe("no_contrast")
  })

  it("falls back when energy doesn't track caffeine at all (no signal)", () => {
    // Levels fixed per time of day, independent of dosing — within-band
    // variance is zero, so no candidate can correlate.
    const checkins: CaffeineCheckin[] = Array.from({ length: 20 }, (_, i) => {
      const isA = i % 4 < 2
      const morning = i % 2 === 0
      return {
        hour: morning ? 9 : 20,
        doses: isA && morning ? [{ mg: 300, minutesAgo: 120 }] : [],
        level: morning ? 4 : 2,
      }
    })
    const model = learnCaffeineModel(checkins)
    expect(model.personalized).toBe(false)
    expect(model.reason).toBe("no_signal")
  })
})

describe("buildCaffeineCheckins", () => {
  const checkinRows = [{ level: 4, logged_on: "2026-08-06", logged_hour: 9 }]

  it("pairs a check-in with preceding doses as minutes-before", () => {
    const [c] = buildCaffeineCheckins(checkinRows, [
      { mg: 190, logged_at: "2026-08-06T07:00:00" },
    ])
    expect(c.level).toBe(4)
    expect(c.hour).toBe(9)
    expect(c.doses).toEqual([{ mg: 190, minutesAgo: 120 }])
  })

  it("drops future doses and doses beyond the 18h window", () => {
    const [c] = buildCaffeineCheckins(checkinRows, [
      { mg: 100, logged_at: "2026-08-06T11:00:00" }, // 2h after
      { mg: 100, logged_at: "2026-08-05T10:00:00" }, // 23h before
    ])
    expect(c.doses).toEqual([])
  })

  it("keeps a yesterday-evening dose inside the window", () => {
    const [c] = buildCaffeineCheckins(checkinRows, [
      { mg: 80, logged_at: "2026-08-05T20:00:00" }, // 13h before
    ])
    expect(c.doses).toEqual([{ mg: 80, minutesAgo: 780 }])
  })
})

describe("display helpers", () => {
  it("formats half-lives", () => {
    expect(formatHalfLife(330)).toBe("5.5h")
    expect(formatHalfLife(480)).toBe("8h")
  })

  it("says nothing for the population default", () => {
    expect(
      describeCaffeineModel(learnCaffeineModel([]))
    ).toBeNull()
  })

  it("describes a slow clearer with high sensitivity", () => {
    const msg = describeCaffeineModel({
      halfLifeMin: 540,
      personalized: true,
      energyPer100mg: 0.6,
      sensitivity: "high",
      observations: 24,
    })
    expect(msg).toMatch(/slower than typical/)
    expect(msg).toMatch(/9h half-life/)
    expect(msg).toMatch(/timing matters/)
  })

  it("describes a typical clearer plainly", () => {
    const msg = describeCaffeineModel({
      halfLifeMin: 330,
      personalized: true,
      energyPer100mg: 0.3,
      sensitivity: "typical",
      observations: 15,
    })
    expect(msg).toMatch(/about typical/)
    expect(msg).not.toMatch(/timing matters/)
  })
})
