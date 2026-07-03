import { describe, it, expect } from "vitest"
import {
  parseLimitations,
  excludedExerciseIds,
  affectsLowerBody,
} from "./limitations"
import { exercises } from "@/data/exercises"

describe("parseLimitations", () => {
  it("returns empty for blank or null text", () => {
    expect(parseLimitations(null)).toEqual([])
    expect(parseLimitations(undefined)).toEqual([])
    expect(parseLimitations("")).toEqual([])
  })

  it("returns empty for text without recognized areas", () => {
    expect(parseLimitations("I get bored easily")).toEqual([])
  })

  it("detects single areas from natural phrasing", () => {
    expect(parseLimitations("bad knee")).toEqual(["knee"])
    expect(parseLimitations("Recovering from rotator cuff surgery")).toEqual([
      "shoulder",
    ])
    expect(parseLimitations("herniated disc")).toEqual(["lower_back"])
  })

  it("detects multiple areas", () => {
    const areas = parseLimitations("bad knees and a sore shoulder")
    expect(areas).toContain("knee")
    expect(areas).toContain("shoulder")
  })

  it("maps injury-specific terms to the right area", () => {
    expect(parseLimitations("torn ACL in 2020")).toEqual(["knee"])
    expect(parseLimitations("achilles tendinopathy")).toEqual(["ankle"])
    expect(parseLimitations("sciatica flares up")).toEqual(["lower_back"])
  })

  it("requires word boundaries (no substring false positives)", () => {
    // "kneel" should not match "knee", "hips" is fine but "chips" is not
    expect(parseLimitations("I kneel at church")).toEqual([])
    expect(parseLimitations("loves chips")).toEqual([])
  })
})

describe("excludedExerciseIds", () => {
  it("returns empty set for no areas", () => {
    expect(excludedExerciseIds([]).size).toBe(0)
  })

  it("excludes knee-loading exercises for a knee limitation", () => {
    const excluded = excludedExerciseIds(["knee"])
    expect(excluded.has("dumbbell-lunge")).toBe(true)
    expect(excluded.has("smith-machine-squat")).toBe(true)
    expect(excluded.has("leg-extension-exercise")).toBe(true)
    expect(excluded.has("treadmill-run")).toBe(true)
    // Machine-supported alternatives stay available
    expect(excluded.has("leg-press-exercise")).toBe(false)
    expect(excluded.has("leg-curl-exercise")).toBe(false)
  })

  it("excludes overhead pressing for a shoulder limitation but keeps rehab-friendly work", () => {
    const excluded = excludedExerciseIds(["shoulder"])
    expect(excluded.has("dumbbell-shoulder-press")).toBe(true)
    expect(excluded.has("smith-machine-overhead-press")).toBe(true)
    expect(excluded.has("cable-face-pull")).toBe(false)
    expect(excluded.has("reverse-pec-fly")).toBe(false)
  })

  it("unions exclusions across areas", () => {
    const excluded = excludedExerciseIds(["knee", "shoulder"])
    expect(excluded.has("dumbbell-lunge")).toBe(true)
    expect(excluded.has("dumbbell-shoulder-press")).toBe(true)
  })

  it("only references exercise IDs that exist in the catalog", () => {
    const catalogIds = new Set(exercises.map((e) => e.id))
    const allAreas = parseLimitations(
      "knee hip back shoulder elbow wrist ankle"
    )
    for (const id of excludedExerciseIds(allAreas)) {
      expect(catalogIds.has(id)).toBe(true)
    }
  })
})

describe("affectsLowerBody", () => {
  it("is true for joint areas that make impact cardio risky", () => {
    expect(affectsLowerBody(["knee"])).toBe(true)
    expect(affectsLowerBody(["hip"])).toBe(true)
    expect(affectsLowerBody(["ankle"])).toBe(true)
    expect(affectsLowerBody(["lower_back"])).toBe(true)
  })

  it("is false for upper-body-only limitations", () => {
    expect(affectsLowerBody(["shoulder", "wrist", "elbow"])).toBe(false)
    expect(affectsLowerBody([])).toBe(false)
  })
})
