import { describe, it, expect } from "vitest"
import { estimateMaxHeartRate, heartRateZones, zoneRange } from "./heart-rate"

describe("estimateMaxHeartRate", () => {
  it("uses the Tanaka formula (208 - 0.7 x age)", () => {
    expect(estimateMaxHeartRate(51)).toBe(172) // 208 - 35.7 = 172.3
    expect(estimateMaxHeartRate(20)).toBe(194)
    expect(estimateMaxHeartRate(40)).toBe(180)
  })

  it("returns null for missing age", () => {
    expect(estimateMaxHeartRate(null)).toBeNull()
    expect(estimateMaxHeartRate(undefined)).toBeNull()
  })

  it("returns null for implausible ages", () => {
    expect(estimateMaxHeartRate(5)).toBeNull()
    expect(estimateMaxHeartRate(150)).toBeNull()
    expect(estimateMaxHeartRate(NaN)).toBeNull()
    expect(estimateMaxHeartRate(-30)).toBeNull()
  })

  it("accepts the boundary ages", () => {
    expect(estimateMaxHeartRate(13)).toBe(199)
    expect(estimateMaxHeartRate(100)).toBe(138)
  })
})

describe("heartRateZones", () => {
  it("returns 5 contiguous zones spanning 50-100% of max HR", () => {
    const zones = heartRateZones(51)!
    expect(zones).toHaveLength(5)
    // Max HR at 51 is 172
    expect(zones[0]).toMatchObject({ zone: 1, minBpm: 86, maxBpm: 103 })
    expect(zones[4]).toMatchObject({ zone: 5, minBpm: 155, maxBpm: 172 })
    // Each zone starts where the previous ends
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].minBpm).toBe(zones[i - 1].maxBpm)
    }
  })

  it("returns null when age is unknown", () => {
    expect(heartRateZones(null)).toBeNull()
    expect(heartRateZones(undefined)).toBeNull()
  })
})

describe("zoneRange", () => {
  it("spans from the lower zone's floor to the upper zone's ceiling", () => {
    // Age 51, max HR 172: Zone 2 starts at 60% (103), Zone 3 ends at 80% (138)
    expect(zoneRange(51, 2, 3)).toEqual({ minBpm: 103, maxBpm: 138 })
  })

  it("normalizes reversed zone order", () => {
    expect(zoneRange(51, 3, 2)).toEqual(zoneRange(51, 2, 3))
  })

  it("handles a single zone", () => {
    expect(zoneRange(51, 4, 4)).toEqual({ minBpm: 138, maxBpm: 155 })
  })

  it("returns null when age is unknown", () => {
    expect(zoneRange(null, 2, 3)).toBeNull()
  })
})
