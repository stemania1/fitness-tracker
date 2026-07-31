// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"

// push-client reads the VAPID key into a module-level const at import time, and
// isPushSupported() returns false without it. hoisted() runs before the import
// below, which a plain assignment would not.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-vapid-public-key"
})

import { refreshPushSubscription } from "./push-client"

const SUB = {
  endpoint: "https://web.push.apple.com/abc",
  keys: { p256dh: "p", auth: "a" },
}

function stubServiceWorker(getSubscription: () => unknown) {
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      getRegistration: vi
        .fn()
        .mockResolvedValue({ pushManager: { getSubscription } }),
    },
    configurable: true,
  })
}

function stubPushApis() {
  // isPushSupported() needs these three plus the VAPID key (set in vitest env).
  Object.defineProperty(window, "PushManager", { value: {}, configurable: true })
  Object.defineProperty(window, "Notification", { value: {}, configurable: true })
}

afterEach(() => {
  if ("serviceWorker" in navigator) {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("refreshPushSubscription", () => {
  it("no-ops when push isn't supported", async () => {
    await expect(refreshPushSubscription()).resolves.toBe(false)
  })

  it("no-ops when this browser has no subscription", async () => {
    stubPushApis()
    stubServiceWorker(() => Promise.resolve(null))
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(refreshPushSubscription()).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // The scheduled sender skips users with no stored timezone, so re-sending it
  // on load is what heals a profile that never got one.
  it("re-sends the existing subscription with the current timezone", async () => {
    stubPushApis()
    stubServiceWorker(() =>
      Promise.resolve({ toJSON: () => SUB, endpoint: SUB.endpoint })
    )
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)

    await expect(refreshPushSubscription()).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/push/subscribe")
    const body = JSON.parse((init as { body: string }).body)
    expect(body.subscription).toEqual(SUB)
    expect(typeof body.timezone).toBe("string")
    expect(body.timezone.length).toBeGreaterThan(0)
  })

  it("reports failure when the server rejects the refresh", async () => {
    stubPushApis()
    stubServiceWorker(() => Promise.resolve({ toJSON: () => SUB }))
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    await expect(refreshPushSubscription()).resolves.toBe(false)
  })

  // This runs on app boot — a throw here would break the whole app.
  it("swallows a network failure rather than throwing", async () => {
    stubPushApis()
    stubServiceWorker(() => Promise.resolve({ toJSON: () => SUB }))
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    await expect(refreshPushSubscription()).resolves.toBe(false)
  })

  it("swallows a service-worker lookup failure", async () => {
    stubPushApis()
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistration: vi.fn().mockRejectedValue(new Error("no reg")),
      },
      configurable: true,
    })
    await expect(refreshPushSubscription()).resolves.toBe(false)
  })
})
