import { describe, it, expect } from "vitest"
import {
  bestE1RM,
  sessionPerformances,
  readinessPerformance,
  MIN_SESSIONS_PER_GROUP,
  MIN_READINESS_SPREAD,
  type PerfSession,
  type SessionPerformance,
} from "./readiness-performance"

/** A session of one lift at a given weight for 5 reps. */
function session(
  day: string,
  readiness: number | null,
  weight: number,
  key = "bench"
): PerfSession {
  return {
    day,
    readiness,
    exercises: [{ exerciseKey: key, sets: [{ weight, reps: 5 }] }],
  }
}

/** N sessions of the same lift at the same weight, to build a baseline. */
function baseline(count: number, weight = 100, key = "bench"): PerfSession[] {
  return Array.from({ length: count }, (_, i) =>
    session(`2026-01-${String(i + 1).padStart(2, "0")}`, 80, weight, key)
  )
}

/** Scored sessions straight from readiness/relative pairs. */
function perfs(pairs: [number, number][]): SessionPerformance[] {
  return pairs.map(([readiness, relative], i) => ({
    day: `2026-02-${String(i + 1).padStart(2, "0")}`,
    readiness,
    relative,
    lifts: 1,
  }))
}

describe("bestE1RM", () => {
  it("takes the best set, not the last", () => {
    // 100x5 → 116.7; 80x10 → 106.7
    expect(bestE1RM([{ weight: 100, reps: 5 }, { weight: 80, reps: 10 }])).toBeCloseTo(116.67, 1)
  })

  it("ignores unusable sets", () => {
    expect(
      bestE1RM([{ weight: null, reps: 5 }, { weight: 100, reps: null }, { weight: 0, reps: 5 }])
    ).toBeNull()
    expect(bestE1RM([])).toBeNull()
  })
})

describe("sessionPerformances", () => {
  it("scores a lift against its own recent median", () => {
    // Three sessions at 100, then one at 110 → 10% above the norm. The
    // second and third also score (each has the ones before it), so the
    // session under test is the last.
    const out = sessionPerformances([...baseline(3), session("2026-01-04", 90, 110)])
    const today = out[out.length - 1]
    expect(today.relative).toBeCloseTo(1.1, 3)
    expect(today.readiness).toBe(90)
    // The flat baseline days score exactly on par.
    expect(out.slice(0, -1).every((p) => Math.abs(p.relative - 1) < 1e-9)).toBe(true)
  })

  // The mistake that would quietly destroy the finding: including today in
  // its own baseline pulls every score toward 1.
  it("never lets a session inform its own baseline", () => {
    const out = sessionPerformances([...baseline(1), session("2026-01-02", 90, 200)])
    // Baseline is the single prior session (100), not a median including 200.
    expect(out[0].relative).toBeCloseTo(200 / 100, 3)
  })

  it("drops the first session of a lift, which has no baseline", () => {
    expect(sessionPerformances([session("2026-01-01", 80, 100)])).toEqual([])
  })

  it("averages across the lifts in a session", () => {
    const prior: PerfSession[] = [
      {
        day: "2026-01-01",
        readiness: 80,
        exercises: [
          { exerciseKey: "bench", sets: [{ weight: 100, reps: 5 }] },
          { exerciseKey: "row", sets: [{ weight: 100, reps: 5 }] },
        ],
      },
    ]
    const today: PerfSession = {
      day: "2026-01-02",
      readiness: 90,
      exercises: [
        { exerciseKey: "bench", sets: [{ weight: 120, reps: 5 }] }, // +20%
        { exerciseKey: "row", sets: [{ weight: 100, reps: 5 }] }, // +0%
      ],
    }
    const out = sessionPerformances([...prior, today])
    expect(out[0].relative).toBeCloseTo(1.1, 3)
    expect(out[0].lifts).toBe(2)
  })

  // Weight is counterweight on these, so an Epley estimate over it is not a
  // strength measure and must not enter the same average.
  it("excludes assisted lifts entirely", () => {
    const prior: PerfSession[] = [
      {
        day: "2026-01-01",
        readiness: 80,
        exercises: [{ exerciseKey: "assisted-pull-up", assisted: true, sets: [{ weight: 80, reps: 5 }] }],
      },
    ]
    const today: PerfSession = {
      day: "2026-01-02",
      readiness: 90,
      exercises: [{ exerciseKey: "assisted-pull-up", assisted: true, sets: [{ weight: 40, reps: 5 }] }],
    }
    expect(sessionPerformances([...prior, today])).toEqual([])
  })

  it("skips sessions with no readiness score", () => {
    const out = sessionPerformances([...baseline(2), session("2026-01-03", null, 110)])
    // The scoreable baseline day survives; the unscored day is absent.
    expect(out.map((p) => p.day)).toEqual(["2026-01-02"])
  })

  it("orders by day regardless of input order, so baselines stay causal", () => {
    const out = sessionPerformances([
      session("2026-01-03", 90, 110),
      session("2026-01-01", 80, 100),
      session("2026-01-02", 80, 100),
    ])
    expect(out.map((p) => p.day)).toEqual(["2026-01-02", "2026-01-03"])
    expect(out[1].relative).toBeCloseTo(1.1, 3)
  })

  it("uses only the most recent N sessions as the baseline", () => {
    // Six sessions at 100, then five at 200, then today at 200. With a
    // window of 5 the old 100s have aged out, so the norm is 200 and today
    // is on par. Taking the whole history instead would median to 100 and
    // score today as a 100% jump.
    const old = baseline(6, 100)
    const recent = Array.from({ length: 5 }, (_, i) =>
      session(`2026-01-${String(i + 7).padStart(2, "0")}`, 80, 200)
    )
    const out = sessionPerformances(
      [...old, ...recent, session("2026-01-12", 90, 200)],
      5
    )
    expect(out[out.length - 1].relative).toBeCloseTo(1, 3)
  })
})

describe("readinessPerformance — guards", () => {
  it("refuses to report below the per-group minimum", () => {
    const result = readinessPerformance(
      perfs(Array.from({ length: MIN_SESSIONS_PER_GROUP * 2 - 1 }, (_, i) => [70 + i, 1]))
    )
    expect(result.verdict).toBe("not-enough-data")
    expect(result.low).toBeNull()
    expect(result.headline).toMatch(/not enough sessions/i)
  })

  // A median split always yields a "high" and a "low" group, even when every
  // score sits within a couple of points. Comparing those is noise dressed up
  // as a finding.
  it("refuses when readiness barely varies", () => {
    const flat = perfs(
      Array.from({ length: 20 }, (_, i) => [79 + (i % 3), i < 10 ? 1.0 : 1.3])
    )
    const result = readinessPerformance(flat)
    expect(result.verdict).toBe("no-spread")
    expect(result.headline).toMatch(/barely moves/i)
  })

  it("reports no relationship when the difference is inside normal variation", () => {
    // Wide readiness spread, ~1% performance difference.
    const result = readinessPerformance(
      perfs([
        [60, 1.0], [62, 0.99], [64, 1.01], [66, 1.0], [61, 1.0],
        [63, 0.99], [65, 1.01], [67, 1.0],
        [88, 1.01], [90, 1.0], [92, 1.02], [94, 1.01], [89, 1.0],
        [91, 1.01], [93, 1.02], [95, 1.01],
      ])
    )
    expect(result.verdict).toBe("no-relationship")
    expect(result.headline).toMatch(/doesn't predict/i)
    // The useful part: it says what that means for the gate.
    expect(result.detail).toMatch(/downshifting/i)
  })
})

describe("readinessPerformance — findings", () => {
  const lowDays: [number, number][] = [
    [60, 0.95], [62, 0.94], [64, 0.96], [66, 0.95],
    [61, 0.94], [63, 0.96], [65, 0.95], [67, 0.95],
  ]
  const highDays: [number, number][] = [
    [88, 1.05], [90, 1.04], [92, 1.06], [94, 1.05],
    [89, 1.04], [91, 1.06], [93, 1.05], [95, 1.05],
  ]

  it("reports a real positive relationship with its size", () => {
    const result = readinessPerformance(perfs([...lowDays, ...highDays]))
    expect(result.verdict).toBe("predicts")
    expect(result.delta).toBeCloseTo(0.1, 2)
    expect(result.headline).toMatch(/10% better on high-readiness/i)
    expect(result.low?.n).toBe(8)
    expect(result.high?.n).toBe(8)
    expect(result.high!.meanReadiness).toBeGreaterThan(result.low!.meanReadiness)
  })

  it("reports the inverse direction, with a caution rather than advice", () => {
    const result = readinessPerformance(
      perfs([...lowDays.map(([r]) => [r, 1.05] as [number, number]),
             ...highDays.map(([r]) => [r, 0.95] as [number, number])])
    )
    expect(result.verdict).toBe("inverse")
    expect(result.headline).toMatch(/better on low-readiness/i)
    expect(result.detail).toMatch(/curiosity/i)
  })

  it("drops the middle session on an odd count to sharpen the split", () => {
    const odd = perfs([...lowDays, [75, 1.0], ...highDays])
    const result = readinessPerformance(odd)
    expect(result.sessions).toBe(17)
    expect(result.low?.n).toBe(8)
    expect(result.high?.n).toBe(8)
  })

  it("always reports n and both group means, whatever the verdict", () => {
    const result = readinessPerformance(perfs([...lowDays, ...highDays]))
    expect(result.sessions).toBe(16)
    expect(result.detail).toContain("16 sessions")
    expect(result.low?.meanReadiness).toBeCloseTo(63.5, 1)
    expect(result.high?.meanReadiness).toBeCloseTo(91.5, 1)
  })

  it("needs the group means to differ by the full spread threshold", () => {
    const spread = perfs([
      ...Array.from({ length: 8 }, (_, i) => [70 + (i % 2), 0.9] as [number, number]),
      ...Array.from(
        { length: 8 },
        (_, i) => [70 + MIN_READINESS_SPREAD + (i % 2), 1.1] as [number, number]
      ),
    ])
    expect(readinessPerformance(spread).verdict).toBe("predicts")
  })
})
