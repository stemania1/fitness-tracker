"use client"

import { useEffect } from "react"
import { registerServiceWorker } from "@/lib/service-worker"
import { refreshPushSubscription } from "@/lib/push-client"

/**
 * Registers and refreshes the web-push service worker on every app load, so an
 * installed PWA reliably picks up the newest worker instead of running a stale
 * one indefinitely, and re-sends an existing push subscription so the server
 * always has a current timezone for it (the scheduled sender skips users
 * without one). Renders nothing; mount once in the authenticated layout.
 */
export function ServiceWorkerManager() {
  useEffect(() => {
    void (async () => {
      // Awaited in sequence, not chained: the refresh wants a registered
      // worker, and `await` tolerates a non-promise return.
      await registerServiceWorker()
      await refreshPushSubscription()
    })()
  }, [])
  return null
}
