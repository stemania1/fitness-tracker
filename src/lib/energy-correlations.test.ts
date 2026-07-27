import { describe, it, expect } from "vitest"
import {
  analyzeEnergyDrivers,
  type DayObservation,
  type FactorSpec,
} from "./energy-correlations"

const SPECS: FactorSpec[] = [
  { key: "trained", kind: "boolean", whenHigh: "on days you train" },
  { key: "caffeineMg", kind: "numeric", whenHigh: "on higher-caffeine days" },
]

/** Build a day with a given energy and factor values. */
function day(energy: number, factors: DayObservation["factors"]): DayObservation {
  return { energy, factors }
}

describe("analyzeEnergyDrivers", () => {
  it("finds a boolean factor that raises energy", () => {
    const days = [
      ...Array(5).fill(0).map(() => day(4, { trained: true })),
      ...Array(5).fill(0).map(() => day(3, { trained: false })),
    ]
    const out = analyzeEnergyDrivers(days, [SPECS[0]])
    expect(out).toHaveLength(1)
    expect(out[0].key).toBe("trained")
    expect(out[0].direction).toBe("higher")
    expect(out[0].deltaPct).toBe(33) // 4 vs 3
    expect(out[0].message).toMatch(/33% higher on days you train/)
  })

  it("finds a boolean factor that lowers energy", () => {
    const days = [
      ...Array(5).fill(0).map(() => day(2.5, { trained: true })),
      ...Array(5).fill(0).map(() => day(4, { trained: false })),
    ]
    const out = analyzeEnergyDrivers(days, [SPECS[0]])
    expect(out[0].direction).toBe("lower")
    expect(out[0].deltaPct).toBeLessThan(0)
  })

  it("splits a numeric factor at the median", () => {
    // High caffeine → lower energy.
    const days = [
      day(2, { caffeineMg: 300 }),
      day(2, { caffeineMg: 250 }),
      day(3, { caffeineMg: 220 }),
      day(2, { caffeineMg: 210 }),
      day(4, { caffeineMg: 90 }),
      day(4, { caffeineMg: 80 }),
      day(5, { caffeineMg: 60 }),
      day(4, { caffeineMg: 50 }),
    ]
    const out = analyzeEnergyDrivers(days, [SPECS[1]], { minGroup: 4 })
    expect(out[0].key).toBe("caffeineMg")
    expect(out[0].direction).toBe("lower")
  })

  it("skips factors without enough days in each group", () => {
    const days = [
      day(4, { trained: true }),
      day(4, { trained: true }),
      ...Array(6).fill(0).map(() => day(3, { trained: false })),
    ]
    expect(analyzeEnergyDrivers(days, [SPECS[0]], { minGroup: 4 })).toEqual([])
  })

  it("skips factors whose effect is below the threshold", () => {
    const days = [
      ...Array(5).fill(0).map(() => day(3.1, { trained: true })),
      ...Array(5).fill(0).map(() => day(3.0, { trained: false })),
    ]
    expect(
      analyzeEnergyDrivers(days, [SPECS[0]], { minGroup: 4, minDeltaPct: 8 })
    ).toEqual([])
  })

  it("ignores null factor values", () => {
    const days = [
      ...Array(5).fill(0).map(() => day(4, { trained: true })),
      ...Array(5).fill(0).map(() => day(3, { trained: false })),
      ...Array(3).fill(0).map(() => day(1, { trained: null })),
    ]
    const out = analyzeEnergyDrivers(days, [SPECS[0]])
    expect(out[0].highCount).toBe(5)
    expect(out[0].lowCount).toBe(5)
  })

  it("ranks the strongest effect first and caps the list", () => {
    const days = [
      // trained: 5 vs 3 (big); caffeine: mild
      ...Array(5).fill(0).map((_, i) =>
        day(5, { trained: true, caffeineMg: 100 + i })
      ),
      ...Array(5).fill(0).map((_, i) =>
        day(3, { trained: false, caffeineMg: 90 + i })
      ),
    ]
    const out = analyzeEnergyDrivers(days, SPECS, { max: 1 })
    expect(out).toHaveLength(1)
    expect(out[0].key).toBe("trained")
  })
})
