import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  upsert: vi.fn(),
  resolveToken: vi.fn(),
  getHistory: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_t: string) => ({ upsert: mocks.upsert }),
  }),
}))
vi.mock("@/lib/oura-token", () => ({
  resolveOuraAccessToken: mocks.resolveToken,
}))
vi.mock("@/lib/oura", () => ({ getOuraDailyHistory: mocks.getHistory }))

import { POST } from "./route"

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.upsert.mockReset().mockResolvedValue({ error: null })
  mocks.resolveToken.mockReset().mockResolvedValue({ ok: true, accessToken: "t" })
  mocks.getHistory.mockReset().mockResolvedValue([])
})

describe("POST /api/oura/sync", () => {
  it("401s without a user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it("no-ops when Oura isn't connected", async () => {
    mocks.resolveToken.mockResolvedValue({ ok: false, reason: "not_connected" })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ synced: 0, connected: false })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it("returns synced 0 when there's no history", async () => {
    mocks.getHistory.mockResolvedValue([])
    const res = await POST()
    expect(await res.json()).toEqual({ synced: 0, connected: true })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it("upserts history rows and reports the count", async () => {
    mocks.getHistory.mockResolvedValue([
      { day: "2026-07-25", sleepScore: 80, sleepMinutes: 450, readinessScore: 72, averageHrv: 55 },
      { day: "2026-07-26", sleepScore: 85, sleepMinutes: 460, readinessScore: 75, averageHrv: 60 },
    ])
    const res = await POST()
    expect(await res.json()).toEqual({ synced: 2, connected: true })
    const rows = mocks.upsert.mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      user_id: "u1",
      day: "2026-07-25",
      sleep_score: 80,
      sleep_minutes: 450,
      readiness_score: 72,
    })
  })

  it("500s when the upsert fails", async () => {
    mocks.getHistory.mockResolvedValue([
      { day: "2026-07-25", sleepScore: 80, sleepMinutes: 450, readinessScore: 72, averageHrv: 55 },
    ])
    mocks.upsert.mockResolvedValue({ error: { message: "db down" } })
    const res = await POST()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe("db down")
  })
})
