import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * The subscribe route decides which account a device's pushes are computed
 * from — the reminder cron iterates whatever `user_id` sits on the
 * subscription row. Getting that wrong is invisible from inside the app and
 * survives logging out and back in, so it's worth pinning down.
 */

const getUser = vi.hoisted(() => vi.fn())
const userUpsert = vi.hoisted(() => vi.fn())
const serviceUpsert = vi.hoisted(() => vi.fn())
const profileUpdate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser },
    from: (table: string) => ({
      upsert: (row: unknown, opts: unknown) => userUpsert(table, row, opts),
      update: (values: unknown) => ({
        eq: (_col: string, val: unknown) => profileUpdate(table, values, val),
      }),
    }),
  }),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      upsert: (row: unknown, opts: unknown) => serviceUpsert(table, row, opts),
    }),
  }),
}))

import { POST } from "./route"

const SUBSCRIPTION = {
  endpoint: "https://push.example/abc",
  keys: { p256dh: "key", auth: "auth" },
}

function post(body: unknown) {
  return POST(
    new Request("https://app.test/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } })
  userUpsert.mockReset().mockResolvedValue({ error: null })
  serviceUpsert.mockReset().mockResolvedValue({ error: null })
  profileUpdate.mockReset().mockResolvedValue({ error: null })
})

describe("push subscribe", () => {
  it("rejects a request with no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await post({ subscription: SUBSCRIPTION })
    expect(res.status).toBe(401)
    expect(serviceUpsert).not.toHaveBeenCalled()
  })

  it("rejects a subscription missing its keys", async () => {
    const res = await post({ subscription: { endpoint: "https://push/x" } })
    expect(res.status).toBe(400)
    expect(serviceUpsert).not.toHaveBeenCalled()
  })

  it("rejects a body that isn't JSON", async () => {
    const res = await POST(
      new Request("https://app.test/api/push/subscribe", {
        method: "POST",
        body: "not json",
      })
    )
    expect(res.status).toBe(400)
  })

  /**
   * The bug this guards: written with the caller's client, the upsert's update
   * half is refused by RLS (`auth.uid() = user_id` against the EXISTING row)
   * whenever the endpoint already belongs to another account. The row keeps
   * its old owner and the device keeps getting that account's reminders.
   */
  it("claims the endpoint for the current user via the service client", async () => {
    const res = await post({ subscription: SUBSCRIPTION })
    expect(res.status).toBe(200)

    expect(serviceUpsert).toHaveBeenCalledTimes(1)
    const [table, row, opts] = serviceUpsert.mock.calls[0]
    expect(table).toBe("push_subscriptions")
    expect(row).toMatchObject({ user_id: "user-1", endpoint: SUBSCRIPTION.endpoint })
    expect(opts).toMatchObject({ onConflict: "endpoint" })

    // Never through the caller's client, which RLS would silently refuse.
    expect(userUpsert).not.toHaveBeenCalled()
  })

  it("reports a failed upsert instead of claiming success", async () => {
    serviceUpsert.mockResolvedValue({ error: { message: "nope" } })
    const res = await post({ subscription: SUBSCRIPTION })
    expect(res.status).toBe(500)
  })

  it("records the timezone on the caller's own profile", async () => {
    const res = await post({
      subscription: SUBSCRIPTION,
      timezone: "America/New_York",
    })
    const body = await res.json()

    expect(profileUpdate).toHaveBeenCalledWith(
      "user_profiles",
      { timezone: "America/New_York" },
      "user-1"
    )
    expect(body).toMatchObject({ ok: true, timezoneSaved: true })
  })

  it("surfaces a timezone write failure, since the cron skips users without one", async () => {
    profileUpdate.mockResolvedValue({ error: { message: "denied" } })
    const res = await post({
      subscription: SUBSCRIPTION,
      timezone: "America/New_York",
    })
    const body = await res.json()

    expect(body).toMatchObject({ timezoneSaved: false, timezoneError: "denied" })
  })
})
