import { describe, it, expect } from "vitest"
import { queryKeys } from "./keys"

/**
 * These assertions are about the *shape* of the keys, because that shape is
 * load-bearing. Mutations invalidate by prefix — `["caffeine-today"]` is meant
 * to match `["caffeine-today", dayStart]` — so a parameterised key must keep
 * its literal prefix as element 0, and two different arguments must not
 * collapse onto the same key.
 */
describe("queryKeys", () => {
  it("keeps a stable literal prefix on parameterised keys", () => {
    expect(queryKeys.caffeineToday("2026-08-01T04:00:00.000Z")[0]).toBe(
      "caffeine-today"
    )
    expect(queryKeys.creatineLogs("2026-08-01")[0]).toBe("creatine-logs")
    expect(queryKeys.energyCheckins("2026-08-01")[0]).toBe("energy-checkins")
    expect(queryKeys.foodLogsToday("2026-08-01T04:00:00.000Z")[0]).toBe(
      "food-logs-today"
    )
  })

  it("separates different days into different cache entries", () => {
    expect(queryKeys.creatineLogs("2026-08-01")).not.toEqual(
      queryKeys.creatineLogs("2026-08-02")
    )
    expect(queryKeys.energyCheckins("2026-08-01")).not.toEqual(
      queryKeys.energyCheckins("2026-08-02")
    )
  })

  it("keys weekly calories on the weight, so a weigh-in recomputes them", () => {
    const before = queryKeys.weeklyCalories("2026-07-27", 185)
    const after = queryKeys.weeklyCalories("2026-07-27", 183)
    expect(before).not.toEqual(after)
    expect(before[0]).toBe("weekly-calories")
  })

  it("is stable for the same arguments", () => {
    expect(queryKeys.ouraTrend(56)).toEqual(queryKeys.ouraTrend(56))
    expect(queryKeys.workoutTemplate("abc")).toEqual(
      queryKeys.workoutTemplate("abc")
    )
  })

  it("gives every key a distinct prefix", () => {
    const prefixes = [
      queryKeys.authUser[0],
      queryKeys.profile[0],
      queryKeys.profileStats[0],
      queryKeys.workoutLogsAll[0],
      queryKeys.recentWorkouts[0],
      queryKeys.workoutTemplates[0],
      queryKeys.allStrengthSets[0],
      queryKeys.setLogsAll[0],
      queryKeys.userGoals[0],
      queryKeys.ouraSummary[0],
      queryKeys.ouraConnected[0],
      queryKeys.weeklyDigest[0],
      queryKeys.lastWeighIn[0],
      queryKeys.weightLogs[0],
      queryKeys.weightLogsRecent[0],
    ]
    expect(new Set(prefixes).size).toBe(prefixes.length)
  })

  it("does not let workout-templates collide with workout-template", () => {
    // A prefix invalidation of one must not sweep the other.
    expect(queryKeys.workoutTemplates[0]).not.toBe(
      queryKeys.workoutTemplate("x")[0]
    )
  })
})
