import { describe, it, expect } from "vitest"
import {
  prThreshold,
  isSessionPersonalRecord,
  type SessionSet,
  type SessionPrInput,
} from "./session-pr"

function s(
  weight: number | null,
  reps: number | null,
  completed = true
): SessionSet {
  return { weight, reps, completed }
}

function input(over: Partial<SessionPrInput> = {}): SessionPrInput {
  return {
    sets: [s(100, 8)],
    index: 0,
    assisted: false,
    allTimeMaxWeight: null,
    allTimeMinWeight: null,
    isCardio: false,
    ...over,
  }
}

describe("prThreshold", () => {
  it("is null when there is no history and no earlier set", () => {
    expect(prThreshold(input())).toBeNull()
  })

  it("is the all-time max when no earlier set beats it", () => {
    expect(prThreshold(input({ allTimeMaxWeight: 185 }))).toBe(185)
  })

  it("takes the heaviest earlier completed set when it beats history", () => {
    const sets = [s(190, 5), s(200, 5), s(150, 5)]
    expect(prThreshold(input({ sets, index: 2, allTimeMaxWeight: 185 }))).toBe(200)
  })

  it("ignores earlier sets that were never completed", () => {
    const sets = [s(500, 5, false), s(100, 5)]
    expect(prThreshold(input({ sets, index: 1, allTimeMaxWeight: 185 }))).toBe(185)
  })

  it("ignores later sets — only what came before counts", () => {
    const sets = [s(100, 5), s(400, 5)]
    expect(prThreshold(input({ sets, index: 0, allTimeMaxWeight: 185 }))).toBe(185)
  })

  // Assisted weight is machine help, so the bar is the LEAST used.
  it("takes the minimum for assisted exercises", () => {
    const sets = [s(60, 8), s(50, 8), s(70, 8)]
    expect(
      prThreshold(input({ sets, index: 2, assisted: true, allTimeMinWeight: 65 }))
    ).toBe(50)
  })

  it("reads the assisted history field, not the loaded one", () => {
    const only = input({ assisted: true, allTimeMinWeight: 40, allTimeMaxWeight: 900 })
    expect(prThreshold(only)).toBe(40)
  })
})

describe("isSessionPersonalRecord", () => {
  it("is a record when there is no history at all", () => {
    expect(isSessionPersonalRecord(input())).toBe(true)
  })

  it("is a record when the set beats the all-time max", () => {
    expect(
      isSessionPersonalRecord(input({ sets: [s(200, 5)], allTimeMaxWeight: 185 }))
    ).toBe(true)
  })

  it("is not a record when the set merely matches the all-time max", () => {
    expect(
      isSessionPersonalRecord(input({ sets: [s(185, 5)], allTimeMaxWeight: 185 }))
    ).toBe(false)
  })

  // The reason the session half exists: without it, three sets at the same
  // new weight would each light up a trophy.
  it("only fires on the first set at a new best weight", () => {
    const sets = [s(200, 5), s(200, 5), s(200, 5)]
    const at = (index: number) =>
      isSessionPersonalRecord(input({ sets, index, allTimeMaxWeight: 185 }))
    expect(at(0)).toBe(true)
    expect(at(1)).toBe(false)
    expect(at(2)).toBe(false)
  })

  it("fires again if a later set goes heavier still", () => {
    const sets = [s(200, 5), s(210, 5)]
    expect(isSessionPersonalRecord(input({ sets, index: 1, allTimeMaxWeight: 185 })))
      .toBe(true)
  })

  it("does not fire on a set that hasn't been checked off", () => {
    expect(
      isSessionPersonalRecord(
        input({ sets: [s(300, 5, false)], allTimeMaxWeight: 185 })
      )
    ).toBe(false)
  })

  it("never fires for cardio", () => {
    expect(
      isSessionPersonalRecord(input({ sets: [s(200, 5)], isCardio: true }))
    ).toBe(false)
  })

  it("needs both a weight and reps", () => {
    expect(isSessionPersonalRecord(input({ sets: [s(200, null)] }))).toBe(false)
    expect(isSessionPersonalRecord(input({ sets: [s(null, 5)] }))).toBe(false)
  })

  describe("assisted exercises", () => {
    it("fires on LESS assistance than the all-time minimum", () => {
      const i = input({ sets: [s(50, 8)], assisted: true, allTimeMinWeight: 60 })
      expect(isSessionPersonalRecord(i)).toBe(true)
    })

    it("does not fire on MORE assistance", () => {
      const i = input({ sets: [s(70, 8)], assisted: true, allTimeMinWeight: 60 })
      expect(isSessionPersonalRecord(i)).toBe(false)
    })

    it("only fires on the first set at a new lightest assistance", () => {
      const sets = [s(50, 8), s(50, 8)]
      const i = (index: number) =>
        isSessionPersonalRecord(
          input({ sets, index, assisted: true, allTimeMinWeight: 60 })
        )
      expect(i(0)).toBe(true)
      expect(i(1)).toBe(false)
    })
  })

  it("is false for an index that isn't there", () => {
    expect(isSessionPersonalRecord(input({ sets: [], index: 0 }))).toBe(false)
  })
})
