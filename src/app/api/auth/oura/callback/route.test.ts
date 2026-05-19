import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_table: string) => ({
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => mocks.upsert(values, options),
    }),
  }),
}))

import { GET } from "./route"

const realFetch = globalThis.fetch
const realEnv = { ...process.env }

beforeEach(() => {
  mocks.getUser.mockReset()
  mocks.upsert.mockReset().mockResolvedValue({ error: null })
  process.env.OURA_CLIENT_ID = "test-client-id"
  process.env.OURA_CLIENT_SECRET = "test-secret"
})

afterEach(() => {
  globalThis.fetch = realFetch
  process.env = { ...realEnv }
})

function req(qs = ""): NextRequest {
  return new NextRequest(`http://localhost/api/auth/oura/callback${qs}`)
}

function expectRedirectsTo(
  res: Response,
  pathname: string,
  searchParams: Record<string, string> = {}
) {
  expect(res.status).toBe(307)
  const loc = new URL(res.headers.get("location") ?? "")
  expect(loc.pathname).toBe(pathname)
  for (const [k, v] of Object.entries(searchParams)) {
    expect(loc.searchParams.get(k)).toBe(v)
  }
}

describe("GET /api/auth/oura/callback — pre-token-exchange branches", () => {
  it("returns 200 OK to a validation ping (no code, no error)", async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("OK")
  })

  it("redirects with oura_reason=user_denied when error=access_denied", async () => {
    const res = await GET(req("?error=access_denied"))
    expectRedirectsTo(res, "/profile", {
      oura: "error",
      oura_reason: "user_denied",
    })
  })

  it("maps other Oura error params to oura_reason=missing_code", async () => {
    const res = await GET(req("?error=server_error"))
    expectRedirectsTo(res, "/profile", { oura_reason: "missing_code" })
  })

  it("redirects with oura_reason=missing_env when client id is missing", async () => {
    delete process.env.OURA_CLIENT_ID
    const res = await GET(req("?code=abc"))
    expectRedirectsTo(res, "/profile", { oura_reason: "missing_env" })
  })

  it("redirects with oura_reason=missing_env when client secret is missing", async () => {
    delete process.env.OURA_CLIENT_SECRET
    const res = await GET(req("?code=abc"))
    expectRedirectsTo(res, "/profile", { oura_reason: "missing_env" })
  })
})

describe("GET /api/auth/oura/callback — token exchange failures", () => {
  it("redirects with oura_reason=token_exchange when fetch throws", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch
    const res = await GET(req("?code=abc"))
    expectRedirectsTo(res, "/profile", { oura_reason: "token_exchange" })
    // Must not have called Supabase if we never got tokens.
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it("redirects with oura_reason=token_exchange when Oura returns non-OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "invalid_grant",
    }) as unknown as typeof fetch
    const res = await GET(req("?code=abc"))
    expectRedirectsTo(res, "/profile", { oura_reason: "token_exchange" })
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
})

describe("GET /api/auth/oura/callback — post-token-exchange branches", () => {
  function mockSuccessfulTokenExchange() {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "access-1",
        refresh_token: "refresh-1",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    }) as unknown as typeof fetch
  }

  it("redirects with oura_reason=not_authenticated when there is no user", async () => {
    mockSuccessfulTokenExchange()
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(req("?code=abc"))
    expectRedirectsTo(res, "/profile", { oura_reason: "not_authenticated" })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it("redirects with oura_reason=db_write when token upsert fails", async () => {
    mockSuccessfulTokenExchange()
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.upsert.mockResolvedValue({ error: { message: "permission denied" } })
    const res = await GET(req("?code=abc"))
    expectRedirectsTo(res, "/profile", { oura_reason: "db_write" })
  })

  it("redirects to /profile?oura=connected on full success", async () => {
    mockSuccessfulTokenExchange()
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    const res = await GET(req("?code=abc"))
    expectRedirectsTo(res, "/profile", { oura: "connected" })

    // Verify the row was upserted with the right shape and conflict target.
    expect(mocks.upsert).toHaveBeenCalledTimes(1)
    const [values, options] = mocks.upsert.mock.calls[0]
    expect(values.user_id).toBe("user-1")
    expect(values.access_token).toBe("access-1")
    expect(values.refresh_token).toBe("refresh-1")
    expect(typeof values.expires_at).toBe("string")
    expect(options).toEqual({ onConflict: "user_id" })
  })
})
