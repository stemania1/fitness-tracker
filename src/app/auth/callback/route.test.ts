import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the server Supabase factory before importing the route under test,
// so the route picks up our stub.
const exchangeCodeForSession = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: { exchangeCodeForSession },
  }),
}))

import { GET } from "./route"

beforeEach(() => {
  exchangeCodeForSession.mockReset()
})

function buildRequest(url: string): Request {
  return new Request(url)
}

describe("GET /auth/callback", () => {
  it("redirects to /dashboard on a successful code exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const res = await GET(buildRequest("http://localhost/auth/callback?code=abc"))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost/dashboard")
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc")
  })

  it("honors the ?next= redirect target on success", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const res = await GET(
      buildRequest("http://localhost/auth/callback?code=abc&next=/onboarding")
    )
    expect(res.headers.get("location")).toBe("http://localhost/onboarding")
  })

  it("redirects to /login?error=auth when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } })
    const res = await GET(buildRequest("http://localhost/auth/callback?code=abc"))
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth")
  })

  it("redirects to /login?error=auth when no code is present", async () => {
    const res = await GET(buildRequest("http://localhost/auth/callback"))
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth")
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })
})
