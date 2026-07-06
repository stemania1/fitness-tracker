import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// --- Mock setup ----------------------------------------------------------
// vi.mock factories are hoisted above imports, so the fns they reference must
// be created via vi.hoisted (which runs even earlier).
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  tokenSingle: vi.fn(),
  tokenUpdateEq: vi.fn(),
  getOuraVo2MaxHistory: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({ single: mocks.tokenSingle }),
      }),
      update: (_values: Record<string, unknown>) => ({
        eq: mocks.tokenUpdateEq,
      }),
    }),
  }),
}))

vi.mock("@/lib/oura", () => ({
  getOuraVo2MaxHistory: mocks.getOuraVo2MaxHistory,
}))

const { getUser, tokenSingle, getOuraVo2MaxHistory } = mocks

import { GET } from "./route"

const realFetch = globalThis.fetch

beforeEach(() => {
  getUser.mockReset()
  tokenSingle.mockReset()
  mocks.tokenUpdateEq.mockReset().mockResolvedValue({})
  getOuraVo2MaxHistory.mockReset()
})

afterEach(() => {
  globalThis.fetch = realFetch
})

function reqWith(qs = ""): Request {
  return new Request(`http://localhost/api/oura/vo2max${qs}`)
}

function validTokenRow() {
  return {
    data: {
      access_token: "valid-token",
      refresh_token: "refresh-1",
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    error: null,
  }
}

describe("GET /api/oura/vo2max", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(reqWith())
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe("Unauthorized")
  })

  it("returns 404 when the user has no stored Oura token", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    tokenSingle.mockResolvedValue({ data: null, error: null })
    const res = await GET(reqWith())
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("Oura not connected")
  })

  it("passes an explicit start/end range through to the history fetcher", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    tokenSingle.mockResolvedValue(validTokenRow())
    getOuraVo2MaxHistory.mockResolvedValue([
      { id: "a", day: "2026-07-01", vo2_max: 41.2 },
    ])

    const res = await GET(reqWith("?start=2026-06-01&end=2026-07-01"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: [{ id: "a", day: "2026-07-01", vo2_max: 41.2 }],
    })
    expect(getOuraVo2MaxHistory).toHaveBeenCalledWith(
      "valid-token",
      "2026-06-01",
      "2026-07-01"
    )
  })

  it("defaults to a 180-day window ending today when no range is given", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    tokenSingle.mockResolvedValue(validTokenRow())
    getOuraVo2MaxHistory.mockResolvedValue([])

    const res = await GET(reqWith())
    expect(res.status).toBe(200)

    const [, start, end] = getOuraVo2MaxHistory.mock.calls[0]
    expect(end).toBe(new Date().toISOString().slice(0, 10))
    const expectedStart = new Date(`${end}T00:00:00Z`)
    expectedStart.setUTCDate(expectedStart.getUTCDate() - 180)
    expect(start).toBe(expectedStart.toISOString().slice(0, 10))
  })

  it("returns 401 when the token refresh fails", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    tokenSingle.mockResolvedValue({
      data: {
        access_token: "expired-token",
        refresh_token: "refresh-1",
        expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      error: null,
    })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "invalid_grant",
    }) as unknown as typeof fetch

    const res = await GET(reqWith())
    expect(res.status).toBe(401)
    expect((await res.json()).error).toMatch(/refresh/i)
    expect(getOuraVo2MaxHistory).not.toHaveBeenCalled()
  })
})
