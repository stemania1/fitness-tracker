import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  tokenSingle: vi.fn(),
  tokenUpdateEq: vi.fn(),
  getOuraMetricsHistory: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_table: string) => ({
      select: () => ({ eq: () => ({ single: mocks.tokenSingle }) }),
      update: (_v: Record<string, unknown>) => ({ eq: mocks.tokenUpdateEq }),
    }),
  }),
}))

vi.mock("@/lib/oura", () => ({
  getOuraMetricsHistory: mocks.getOuraMetricsHistory,
}))

const { getUser, tokenSingle, getOuraMetricsHistory } = mocks

import { GET } from "./route"

const realFetch = globalThis.fetch

beforeEach(() => {
  getUser.mockReset()
  tokenSingle.mockReset()
  mocks.tokenUpdateEq.mockReset().mockResolvedValue({})
  getOuraMetricsHistory.mockReset().mockResolvedValue([])
})

afterEach(() => {
  globalThis.fetch = realFetch
})

function reqWith(qs = ""): Request {
  return new Request(`http://localhost/api/oura/metrics${qs}`)
}

function validToken() {
  return {
    data: {
      access_token: "valid-token",
      refresh_token: "refresh-1",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    },
    error: null,
  }
}

describe("GET /api/oura/metrics", () => {
  it("401 without a user", async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(reqWith())
    expect(res.status).toBe(401)
  })

  it("404 when Oura is not connected", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    tokenSingle.mockResolvedValue({ data: null, error: null })
    const res = await GET(reqWith())
    expect(res.status).toBe(404)
  })

  it("defaults to a 60-day window", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    tokenSingle.mockResolvedValue(validToken())
    await GET(reqWith())
    const [, start, end] = getOuraMetricsHistory.mock.calls[0]
    const expected = new Date(`${end}T00:00:00Z`)
    expected.setUTCDate(expected.getUTCDate() - 60)
    expect(start).toBe(expected.toISOString().slice(0, 10))
  })

  it("clamps the requested window to [7, 180] days", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    tokenSingle.mockResolvedValue(validToken())

    await GET(reqWith("?days=999"))
    let [, start, end] = getOuraMetricsHistory.mock.calls[0]
    let expected = new Date(`${end}T00:00:00Z`)
    expected.setUTCDate(expected.getUTCDate() - 180)
    expect(start).toBe(expected.toISOString().slice(0, 10))

    getOuraMetricsHistory.mockClear()
    await GET(reqWith("?days=2"))
    ;[, start, end] = getOuraMetricsHistory.mock.calls[0]
    expected = new Date(`${end}T00:00:00Z`)
    expected.setUTCDate(expected.getUTCDate() - 7)
    expect(start).toBe(expected.toISOString().slice(0, 10))
  })

  it("returns the metrics payload", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } })
    tokenSingle.mockResolvedValue(validToken())
    getOuraMetricsHistory.mockResolvedValue([
      { day: "2026-07-01", remMinutes: 90, remFraction: 0.2 },
    ])
    const res = await GET(reqWith("?days=30"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: [{ day: "2026-07-01", remMinutes: 90, remFraction: 0.2 }],
    })
  })
})
