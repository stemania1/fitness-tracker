import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// --- Mock setup ----------------------------------------------------------
// vi.mock factories are hoisted above imports, so the fns they reference must
// be created via vi.hoisted (which runs even earlier).
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  tokenSingle: vi.fn(),
  tokenUpdateEq: vi.fn(),
  getOuraDailySummary: vi.fn(),
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
  getOuraDailySummary: mocks.getOuraDailySummary,
}))

const { getUser, tokenSingle, tokenUpdateEq, getOuraDailySummary } = mocks

import { GET } from "./route"

const realFetch = globalThis.fetch

beforeEach(() => {
  getUser.mockReset()
  tokenSingle.mockReset()
  tokenUpdateEq.mockReset().mockResolvedValue({})
  getOuraDailySummary.mockReset()
})

afterEach(() => {
  globalThis.fetch = realFetch
})

function reqWith(qs = ""): Request {
  return new Request(`http://localhost/api/oura${qs}`)
}

describe("GET /api/oura", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(reqWith())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 404 when the user has no stored Oura token", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    tokenSingle.mockResolvedValue({ data: null, error: null })
    const res = await GET(reqWith())
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("Oura not connected")
  })

  it("returns the daily summary when the stored token is still valid", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    tokenSingle.mockResolvedValue({
      data: {
        access_token: "valid-token",
        refresh_token: "refresh-1",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      error: null,
    })
    getOuraDailySummary.mockResolvedValue({ steps: 10000 })

    const res = await GET(reqWith("?date=2024-05-01&tz_offset=-04:00"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ steps: 10000 })

    // The valid-token branch should use the stored access token directly.
    expect(getOuraDailySummary).toHaveBeenCalledWith(
      "valid-token",
      "2024-05-01",
      "-04:00"
    )
    // And it should NOT have written new tokens to the database.
    expect(tokenUpdateEq).not.toHaveBeenCalled()
  })

  it("refreshes the access token when it has expired, then returns the summary", async () => {
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
      ok: true,
      json: async () => ({
        access_token: "fresh-token",
        refresh_token: "refresh-2",
        expires_in: 3600,
      }),
    }) as unknown as typeof fetch

    getOuraDailySummary.mockResolvedValue({ score: 80 })

    const res = await GET(reqWith())
    expect(res.status).toBe(200)
    // Summary must be fetched with the *refreshed* token, not the expired one.
    expect(getOuraDailySummary).toHaveBeenCalledWith(
      "fresh-token",
      undefined,
      undefined
    )
    // And the new tokens must have been persisted.
    expect(tokenUpdateEq).toHaveBeenCalledWith("user_id", "user-1")
  })

  it("returns 401 when token refresh fails", async () => {
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
    // We should never have called the summary fetcher on a failed refresh.
    expect(getOuraDailySummary).not.toHaveBeenCalled()
    // Nor should we have written bad tokens.
    expect(tokenUpdateEq).not.toHaveBeenCalled()
  })
})
