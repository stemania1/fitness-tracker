import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the server Supabase factory before importing the route under test,
// so the route picks up our stub.
const verifyOtp = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: { verifyOtp },
  }),
}))

import { GET } from "./route"

beforeEach(() => {
  verifyOtp.mockReset()
})

function buildRequest(url: string): Request {
  return new Request(url)
}

describe("GET /auth/confirm", () => {
  it("verifies the token hash and redirects to /dashboard by default", async () => {
    verifyOtp.mockResolvedValue({ error: null })
    const res = await GET(
      buildRequest("http://localhost/auth/confirm?token_hash=xyz&type=signup")
    )
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost/dashboard")
    expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "xyz" })
  })

  it("honors the ?next= redirect target on success", async () => {
    verifyOtp.mockResolvedValue({ error: null })
    const res = await GET(
      buildRequest(
        "http://localhost/auth/confirm?token_hash=xyz&type=recovery&next=/update-password"
      )
    )
    expect(res.headers.get("location")).toBe("http://localhost/update-password")
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "xyz" })
  })

  it("redirects to /login?error=auth when verification fails", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired token" } })
    const res = await GET(
      buildRequest("http://localhost/auth/confirm?token_hash=xyz&type=signup")
    )
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth")
  })

  it("redirects to /login?error=auth when token_hash or type is missing", async () => {
    const res = await GET(buildRequest("http://localhost/auth/confirm?type=signup"))
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth")
    expect(verifyOtp).not.toHaveBeenCalled()
  })
})
