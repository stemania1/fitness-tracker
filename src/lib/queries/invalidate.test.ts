import { describe, it, expect, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { invalidateWorkoutData } from "./invalidate"
import { queryKeys } from "./keys"

function spyClient() {
  const client = new QueryClient()
  const spy = vi.spyOn(client, "invalidateQueries").mockImplementation(
    () => Promise.resolve()
  )
  return { client, spy }
}

function invalidatedKeys(spy: ReturnType<typeof spyClient>["spy"]): string[][] {
  return spy.mock.calls.map(
    (c) => (c[0] as { queryKey: string[] }).queryKey
  )
}

describe("invalidateWorkoutData", () => {
  it("refreshes the queries the dashboard reads after a workout", () => {
    const { client, spy } = spyClient()
    invalidateWorkoutData(client)
    const keys = invalidatedKeys(spy).map((k) => k[0])

    // This Week's count, streak and calories burned.
    expect(keys).toContain("weekly-workouts")
    expect(keys).toContain("workout-logs-all")
    expect(keys).toContain("weekly-calories")
    // Recent workouts, and the PR / volume feeds.
    expect(keys).toContain("recent-workouts")
    expect(keys).toContain("all-strength-sets")
  })

  it("refreshes the Activity page history", () => {
    const { client, spy } = spyClient()
    invalidateWorkoutData(client)
    expect(invalidatedKeys(spy)).toContainEqual([
      ...queryKeys.workoutHistory,
    ])
  })

  it("invalidates by prefix, so every cached week is covered", () => {
    const { client, spy } = spyClient()
    invalidateWorkoutData(client)
    // A bare prefix — not ["weekly-workouts", someSpecificWeek] — is what
    // lets one call cover every week already in the cache.
    expect(invalidatedKeys(spy)).toContainEqual(["weekly-workouts"])
    expect(invalidatedKeys(spy)).toContainEqual(["weekly-calories"])
  })

  it("does not touch unrelated caches", () => {
    const { client, spy } = spyClient()
    invalidateWorkoutData(client)
    const keys = invalidatedKeys(spy).map((k) => k[0])
    expect(keys).not.toContain("profile")
    expect(keys).not.toContain("caffeine-today")
    expect(keys).not.toContain("oura-summary")
  })
})
