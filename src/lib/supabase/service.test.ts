import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * These assert the one property that matters and is invisible at the call
 * site: every request the service client makes is marked uncacheable. A
 * cached read here froze a cron's view of the database for hours while its
 * writes went through normally, which reads as healthy from every angle
 * except the notification it sent.
 */
describe("createServiceClient", () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd1234.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"
  })

  afterEach(() => {
    process.env = { ...env }
    vi.restoreAllMocks()
  })

  it("sends cache: no-store on the requests it makes", async () => {
    const calls: RequestInit[] = []
    vi.stubGlobal("fetch", (_input: unknown, init?: RequestInit) => {
      calls.push(init ?? {})
      return Promise.resolve(
        new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    })

    const { createServiceClient } = await import("./service")
    await createServiceClient().from("user_profiles").select("id").limit(1)

    expect(calls.length).toBeGreaterThan(0)
    for (const init of calls) expect(init.cache).toBe("no-store")
  })

  it("preserves the headers supabase-js sets, rather than replacing init", async () => {
    const calls: RequestInit[] = []
    vi.stubGlobal("fetch", (_input: unknown, init?: RequestInit) => {
      calls.push(init ?? {})
      return Promise.resolve(
        new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    })

    const { createServiceClient } = await import("./service")
    await createServiceClient().from("user_profiles").select("id").limit(1)

    // The apikey header is how the request authenticates at all; a wrapper
    // that spread its options in the wrong order would drop it and every
    // query would fail with a rejected key.
    const headers = new Headers(calls[0].headers)
    expect(headers.get("apikey")).toBe("service-role-key")
  })

  it("throws with a named cause when the environment is incomplete", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { createServiceClient } = await import("./service")
    expect(() => createServiceClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })
})
