import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the browser client so we control the auth state and can count calls.
// Hoisted because vi.mock is lifted above ordinary const declarations.
const { getUser, onAuthStateChange } = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
}))
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser, onAuthStateChange } }),
}))

import { getAuthUserId, resetAuthUserId } from "./user-query"

beforeEach(() => {
  getUser.mockReset()
  resetAuthUserId()
})

function setUser(user: { id: string } | null) {
  getUser.mockResolvedValue({ data: { user } })
}

describe("getAuthUserId", () => {
  it("returns the signed-in user's id", async () => {
    setUser({ id: "user-1" })
    await expect(getAuthUserId()).resolves.toBe("user-1")
  })

  it("hits the auth endpoint only once across many callers", async () => {
    setUser({ id: "user-1" })
    const ids = await Promise.all([
      getAuthUserId(),
      getAuthUserId(),
      getAuthUserId(),
    ])
    expect(ids).toEqual(["user-1", "user-1", "user-1"])
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it("still hits it only once for calls made after the first resolves", async () => {
    setUser({ id: "user-1" })
    await getAuthUserId()
    await getAuthUserId()
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it("throws when there is no session", async () => {
    setUser(null)
    await expect(getAuthUserId()).rejects.toThrow("Not authenticated")
  })

  it("does not cache a failure — the next caller retries", async () => {
    getUser.mockRejectedValueOnce(new Error("network"))
    await expect(getAuthUserId()).rejects.toThrow("network")

    setUser({ id: "user-2" })
    await expect(getAuthUserId()).resolves.toBe("user-2")
    expect(getUser).toHaveBeenCalledTimes(2)
  })

  it("does not cache a missing session either", async () => {
    setUser(null)
    await expect(getAuthUserId()).rejects.toThrow("Not authenticated")

    setUser({ id: "user-3" })
    await expect(getAuthUserId()).resolves.toBe("user-3")
  })

  it("re-resolves after the session is reset, so a new user is not shadowed", async () => {
    setUser({ id: "user-1" })
    await expect(getAuthUserId()).resolves.toBe("user-1")

    resetAuthUserId()
    setUser({ id: "user-2" })
    await expect(getAuthUserId()).resolves.toBe("user-2")
    expect(getUser).toHaveBeenCalledTimes(2)
  })
})
