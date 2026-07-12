import { describe, it, expect } from "vitest"
import { buildSessionRecap } from "./session-recap"

describe("buildSessionRecap", () => {
  it("flags beaten, matched, and regressed lifts", () => {
    const r = buildSessionRecap([
      { name: "Lat Pulldown", currentTopWeight: 110, previousTopWeight: 100 },
      { name: "Seated Row", currentTopWeight: 90, previousTopWeight: 90 },
      { name: "Curl", currentTopWeight: 25, previousTopWeight: 30 },
    ])
    expect(r.items.map((i) => i.status)).toEqual(["up", "same", "down"])
    expect(r.items[0].delta).toBe(10)
    expect(r.items[2].delta).toBe(-5)
    expect(r.beatCount).toBe(1)
    expect(r.comparableCount).toBe(3)
  })

  it("marks a first-time exercise as new and excludes it from comparable count", () => {
    const r = buildSessionRecap([
      { name: "Face Pull", currentTopWeight: 40, previousTopWeight: null },
    ])
    expect(r.items[0].status).toBe("new")
    expect(r.items[0].delta).toBeNull()
    expect(r.comparableCount).toBe(0)
    expect(r.beatCount).toBe(0)
  })

  it("skips exercises with no weight this session (cardio / bodyweight)", () => {
    const r = buildSessionRecap([
      { name: "Stationary Bike", currentTopWeight: null, previousTopWeight: null },
      { name: "Lat Pulldown", currentTopWeight: 100, previousTopWeight: 95 },
    ])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].name).toBe("Lat Pulldown")
  })

  it("returns empty for a session with nothing weighted", () => {
    const r = buildSessionRecap([
      { name: "Bike", currentTopWeight: null, previousTopWeight: null },
    ])
    expect(r.items).toEqual([])
    expect(r.beatCount).toBe(0)
    expect(r.comparableCount).toBe(0)
  })
})
