import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock @supabase/ssr's createServerClient so we can control the auth state.
const getUser = vi.fn()
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser },
  }),
}))

import { updateSession } from "./middleware"

beforeEach(() => {
  getUser.mockReset()
})

function setUser(user: { id: string } | null) {
  getUser.mockResolvedValue({ data: { user } })
}

async function run(pathname: string): Promise<{
  status: number
  location: string | null
}> {
  const req = new NextRequest(`http://localhost${pathname}`)
  const res = await updateSession(req)
  return {
    status: res.status,
    location: res.headers.get("location"),
  }
}

describe("middleware — unauthenticated users", () => {
  beforeEach(() => setUser(null))

  it("redirects /dashboard to /login", async () => {
    const { status, location } = await run("/dashboard")
    expect(status).toBe(307)
    expect(location).toBe("http://localhost/login")
  })

  it("redirects /workouts to /login", async () => {
    const { location } = await run("/workouts")
    expect(location).toBe("http://localhost/login")
  })

  it("redirects nested paths like /workouts/123 to /login", async () => {
    const { location } = await run("/workouts/abc-123")
    expect(location).toBe("http://localhost/login")
  })

  it("allows the /login page through", async () => {
    const { location } = await run("/login")
    expect(location).toBeNull()
  })

  it("allows the /signup page through", async () => {
    const { location } = await run("/signup")
    expect(location).toBeNull()
  })

  it("allows the root page through (it handles its own redirect)", async () => {
    const { location } = await run("/")
    expect(location).toBeNull()
  })

  it("allows the /auth/callback page through", async () => {
    const { location } = await run("/auth/callback?code=xyz")
    expect(location).toBeNull()
  })

  it("allows the /auth/confirm page through (token-hash verification)", async () => {
    const { location } = await run("/auth/confirm?token_hash=xyz&type=signup")
    expect(location).toBeNull()
  })

  it("allows the /forgot-password page through", async () => {
    const { location } = await run("/forgot-password")
    expect(location).toBeNull()
  })

  it("allows the public /privacy page through", async () => {
    const { location } = await run("/privacy")
    expect(location).toBeNull()
  })

  it("allows the public /terms page through", async () => {
    const { location } = await run("/terms")
    expect(location).toBeNull()
  })

  it("allows the /api/auth/oura callback path through", async () => {
    const { location } = await run("/api/auth/oura/callback?code=abc")
    expect(location).toBeNull()
  })

  it("does NOT allow /api/oura through (it requires auth)", async () => {
    // This is the protected Oura summary endpoint, not the OAuth callback.
    const { location } = await run("/api/oura")
    expect(location).toBe("http://localhost/login")
  })
})

describe("middleware — authenticated users", () => {
  beforeEach(() => setUser({ id: "user-123" }))

  it("redirects /login to /dashboard", async () => {
    const { status, location } = await run("/login")
    expect(status).toBe(307)
    expect(location).toBe("http://localhost/dashboard")
  })

  it("redirects /signup to /dashboard", async () => {
    const { location } = await run("/signup")
    expect(location).toBe("http://localhost/dashboard")
  })

  it("redirects /forgot-password to /dashboard", async () => {
    const { location } = await run("/forgot-password")
    expect(location).toBe("http://localhost/dashboard")
  })

  it("allows /update-password through (recovery session sets a new password)", async () => {
    const { location } = await run("/update-password")
    expect(location).toBeNull()
  })

  it("allows /dashboard through", async () => {
    const { location } = await run("/dashboard")
    expect(location).toBeNull()
  })

  it("allows protected routes through", async () => {
    const { location } = await run("/workouts/new")
    expect(location).toBeNull()
  })

  it("does NOT redirect away from /privacy or /terms", async () => {
    // Public pages should be reachable even when logged in.
    expect((await run("/privacy")).location).toBeNull()
    expect((await run("/terms")).location).toBeNull()
  })
})
