// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { registerServiceWorker } from "./service-worker"

afterEach(() => {
  // Drop any per-test stub so the next test starts from jsdom's default
  // navigator (which has no serviceWorker).
  if ("serviceWorker" in navigator) {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker
  }
  vi.restoreAllMocks()
})

describe("registerServiceWorker", () => {
  it("no-ops when the browser has no service worker support", async () => {
    // jsdom's navigator has no `serviceWorker`.
    await expect(registerServiceWorker()).resolves.toBeUndefined()
  })

  it("registers /sw.js and forces an update check", async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const register = vi.fn().mockResolvedValue({ update })
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    })

    await registerServiceWorker()

    expect(register).toHaveBeenCalledWith("/sw.js")
    expect(update).toHaveBeenCalledTimes(1)
  })

  it("swallows registration failures so app boot never breaks", async () => {
    const register = vi.fn().mockRejectedValue(new Error("registration failed"))
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    })

    await expect(registerServiceWorker()).resolves.toBeUndefined()
  })
})
