import { describe, it, expect } from "vitest"
import { buildWeeklyDigest, type DigestInput } from "@/lib/weekly-digest"
import {
  weeklyDigestNotification,
  isDigestTime,
  DIGEST_WEEKDAY,
  DIGEST_HOUR,
} from "./weekly-digest-push"

function input(over: Partial<DigestInput> = {}): DigestInput {
  return {
    workoutsThisWeek: 2,
    workoutsLastWeek: 3,
    tdee: null,
    weightTrendLbsPerWeek: null,
    targetRateLbsPerWeek: -1,
    avgIntake: null,
    targetIntake: null,
    avgEnergyThisWeek: null,
    avgEnergyLastWeek: null,
    avgSleepHours: null,
    sleepDeltaHours: null,
    topEnergyInsight: null,
    ...over,
  }
}

describe("isDigestTime", () => {
  it("is true only at the digest hour on the digest weekday", () => {
    expect(isDigestTime(DIGEST_WEEKDAY, DIGEST_HOUR)).toBe(true)
  })

  it("is false on the right day at the wrong hour", () => {
    expect(isDigestTime(DIGEST_WEEKDAY, DIGEST_HOUR - 1)).toBe(false)
    expect(isDigestTime(DIGEST_WEEKDAY, 0)).toBe(false)
  })

  it("is false at the right hour on the wrong day", () => {
    expect(isDigestTime(3, DIGEST_HOUR)).toBe(false)
  })

  // A null means we couldn't resolve the user's local time; nudging then would
  // land in the middle of someone's night.
  it("is false when either value is unknown", () => {
    expect(isDigestTime(null, DIGEST_HOUR)).toBe(false)
    expect(isDigestTime(DIGEST_WEEKDAY, null)).toBe(false)
    expect(isDigestTime(null, null)).toBe(false)
  })
})

describe("weeklyDigestNotification", () => {
  it("leads with the top action and gives the week's workouts as context", () => {
    const n = weeklyDigestNotification(buildWeeklyDigest(input({ workoutsThisWeek: 0 })))
    expect(n).not.toBeNull()
    expect(n!.title).toBe("Your week in review")
    expect(n!.body).toContain("0 workouts this week")
    expect(n!.body).toContain("—")
    expect(n!.url).toBe("/dashboard")
  })

  // buildWeeklyDigest always returns an action, including an "on track" filler.
  // Fine inside a card the user opened; spam as an unprompted notification.
  it("sends nothing when the only action is the on-track filler", () => {
    const onTrack = buildWeeklyDigest(
      input({ workoutsThisWeek: 4, workoutsLastWeek: 4, avgSleepHours: 8 })
    )
    expect(onTrack.actions).toHaveLength(1)
    expect(onTrack.actions[0].priority).toBe(10)
    expect(weeklyDigestNotification(onTrack)).toBeNull()
  })

  it("sends when there is something actionable", () => {
    const n = weeklyDigestNotification(
      buildWeeklyDigest(input({ workoutsThisWeek: 2, avgSleepHours: 6.1 }))
    )
    expect(n).not.toBeNull()
    expect(n!.body).toMatch(/sleep|workout/i)
  })

  it("returns null for a digest with no actions at all", () => {
    expect(weeklyDigestNotification({ sections: [], actions: [] })).toBeNull()
  })

  it("falls back to the action alone when there's no fitness section", () => {
    const n = weeklyDigestNotification({
      sections: [],
      actions: [{ text: "Do the thing.", priority: 90 }],
    })
    expect(n!.body).toBe("Do the thing.")
  })
})
