import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { formatSleepDuration, getOuraDailySummary } from "./oura"

const realFetch = globalThis.fetch
const realConsoleError = console.error

beforeEach(() => {
  // Suppress the helper's error logging during expected-failure tests.
  console.error = vi.fn()
})

afterEach(() => {
  globalThis.fetch = realFetch
  console.error = realConsoleError
})

describe("formatSleepDuration", () => {
  it("formats whole hours", () => {
    expect(formatSleepDuration(8 * 3600)).toBe("8h 0m")
  })

  it("formats hours and minutes", () => {
    expect(formatSleepDuration(7 * 3600 + 30 * 60)).toBe("7h 30m")
  })

  it("rounds seconds to the nearest minute", () => {
    expect(formatSleepDuration(7 * 3600 + 30 * 60 + 29)).toBe("7h 30m")
    expect(formatSleepDuration(7 * 3600 + 30 * 60 + 31)).toBe("7h 31m")
  })

  it("handles 0", () => {
    expect(formatSleepDuration(0)).toBe("0h 0m")
  })
})

/**
 * Build a fetch mock that dispatches by URL path-tail (`daily_sleep`,
 * `sleep`, `heartrate`, etc.). Each handler returns a single page; the
 * heartrate handler can take an array of pages for pagination tests.
 */
type Handler = (url: URL) => unknown
function mockFetch(handlers: Record<string, Handler>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (input: string | URL) => {
    const url = new URL(typeof input === "string" ? input : input.toString())
    // Endpoint is the last path segment.
    const endpoint = url.pathname.split("/").filter(Boolean).pop() ?? ""
    const handler = handlers[endpoint]
    if (!handler) {
      // Default to an empty response so unrelated endpoints don't crash.
      return {
        ok: true,
        json: async () => ({ data: [] }),
        text: async () => "",
      }
    }
    const result = handler(url)
    if (result instanceof Response) return result
    return {
      ok: true,
      json: async () => result,
      text: async () => JSON.stringify(result),
    }
  })
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

describe("getOuraDailySummary — happy path", () => {
  it("returns merged data from every endpoint", async () => {
    mockFetch({
      daily_sleep: () => ({
        data: [{ id: "s1", day: "2024-05-01", score: 88 }],
      }),
      sleep: () => ({
        data: [
          {
            id: "sp1",
            day: "2024-05-01",
            type: "long_sleep",
            total_sleep_duration: 7 * 3600,
            average_hrv: 45,
          },
        ],
      }),
      daily_activity: () => ({
        data: [{ id: "a1", day: "2024-05-01", steps: 12000 }],
      }),
      daily_readiness: () => ({
        data: [{ id: "r1", day: "2024-05-01", score: 82 }],
      }),
      heartrate: () => ({
        data: [
          { bpm: 60, source: "rest", timestamp: "2024-05-01T00:00:00Z" },
          { bpm: 62, source: "rest", timestamp: "2024-05-01T00:01:00Z" },
        ],
        next_token: null,
      }),
      daily_spo2: () => ({
        data: [{ id: "o1", day: "2024-05-01", spo2_percentage: { average: 97 } }],
      }),
      daily_stress: () => ({
        data: [{ id: "st1", day: "2024-05-01", day_summary: "normal" }],
      }),
      daily_resilience: () => ({
        data: [{ id: "res1", day: "2024-05-01", level: "solid" }],
      }),
      vo2_max: () => ({
        data: [{ id: "v1", day: "2024-05-01", vo2_max: 48.2 }],
      }),
    })

    const summary = await getOuraDailySummary("token", "2024-05-01")
    expect(summary.sleep?.score).toBe(88)
    expect(summary.sleepPeriod?.type).toBe("long_sleep")
    expect(summary.activity?.steps).toBe(12000)
    expect(summary.readiness?.score).toBe(82)
    expect(summary.spo2?.spo2_percentage?.average).toBe(97)
    expect(summary.stress?.day_summary).toBe("normal")
    expect(summary.resilience?.level).toBe("solid")
    expect(summary.vo2Max).toBe(48.2)
    expect(summary.heartRateReadings.length).toBe(2)
    expect(summary.restingHeartRate).toBe(61) // mean of 60 and 62
  })

  it("sends the access token as a Bearer auth header", async () => {
    const fn = mockFetch({})
    await getOuraDailySummary("my-token", "2024-05-01")
    const init = fn.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer my-token"
    )
  })

  it("uses today's date when no date is supplied", async () => {
    const fn = mockFetch({})
    await getOuraDailySummary("token")
    const url = new URL(fn.mock.calls[0][0] as string)
    const today = new Date().toISOString().split("T")[0]
    expect(url.searchParams.get("start_date")).toBe(today)
    expect(url.searchParams.get("end_date")).toBe(today)
  })

  it("threads tzOffset into the heartrate datetime params", async () => {
    const fn = mockFetch({})
    await getOuraDailySummary("token", "2024-05-01", "-04:00")
    const heartrateCall = fn.mock.calls
      .map((c) => new URL(c[0] as string))
      .find((u) => u.pathname.endsWith("/heartrate"))
    expect(heartrateCall?.searchParams.get("start_datetime")).toBe(
      "2024-05-01T00:00:00-04:00"
    )
    expect(heartrateCall?.searchParams.get("end_datetime")).toBe(
      "2024-05-01T23:59:59-04:00"
    )
  })
})

describe("getOuraDailySummary — failure modes", () => {
  it("returns a fully-null summary when every endpoint 401s", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    })) as unknown as typeof fetch

    const summary = await getOuraDailySummary("token", "2024-05-01")
    expect(summary.sleep).toBeNull()
    expect(summary.activity).toBeNull()
    expect(summary.readiness).toBeNull()
    expect(summary.spo2).toBeNull()
    expect(summary.stress).toBeNull()
    expect(summary.resilience).toBeNull()
    expect(summary.vo2Max).toBeNull()
    expect(summary.heartRateReadings).toEqual([])
    expect(summary.restingHeartRate).toBeNull()
  })

  it("returns null fields for endpoints that come back with no data", async () => {
    mockFetch({
      daily_sleep: () => ({ data: [] }),
      heartrate: () => ({ data: [], next_token: null }),
    })
    const summary = await getOuraDailySummary("token", "2024-05-01")
    expect(summary.sleep).toBeNull()
    expect(summary.heartRateReadings).toEqual([])
    expect(summary.restingHeartRate).toBeNull()
  })
})

describe("getOuraDailySummary — heart rate fallbacks", () => {
  it("falls back to ALL readings when no rest/sleep readings exist", async () => {
    mockFetch({
      heartrate: () => ({
        data: [
          { bpm: 100, source: "workout", timestamp: "2024-05-01T10:00:00Z" },
          { bpm: 80, source: "live", timestamp: "2024-05-01T11:00:00Z" },
        ],
        next_token: null,
      }),
    })
    const summary = await getOuraDailySummary("token", "2024-05-01")
    expect(summary.restingHeartRate).toBe(90)
  })

  it("paginates the heartrate endpoint via next_token", async () => {
    let page = 0
    mockFetch({
      heartrate: (url) => {
        const token = url.searchParams.get("next_token")
        page += 1
        if (token === "page-2") {
          return {
            data: [
              { bpm: 64, source: "rest", timestamp: "2024-05-01T02:00:00Z" },
            ],
            next_token: null,
          }
        }
        return {
          data: [
            { bpm: 60, source: "rest", timestamp: "2024-05-01T00:00:00Z" },
          ],
          next_token: "page-2",
        }
      },
    })
    const summary = await getOuraDailySummary("token", "2024-05-01")
    expect(page).toBe(2)
    expect(summary.heartRateReadings.length).toBe(2)
    // 60 + 64 = 124; mean 62.
    expect(summary.restingHeartRate).toBe(62)
  })

  it("prefers the long_sleep period when multiple sleep periods exist", async () => {
    mockFetch({
      sleep: () => ({
        data: [
          { id: "p1", day: "2024-05-01", type: "late_nap", total_sleep_duration: 1800 },
          { id: "p2", day: "2024-05-01", type: "long_sleep", total_sleep_duration: 7 * 3600 },
        ],
      }),
    })
    const summary = await getOuraDailySummary("token", "2024-05-01")
    expect(summary.sleepPeriod?.id).toBe("p2")
  })
})
