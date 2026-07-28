"use client"

import { useEffect } from "react"
import { registerServiceWorker } from "@/lib/service-worker"

/**
 * Registers and refreshes the web-push service worker on every app load, so an
 * installed PWA reliably picks up the newest worker instead of running a stale
 * one indefinitely. Renders nothing; mount once in the authenticated layout.
 */
export function ServiceWorkerManager() {
  useEffect(() => {
    void registerServiceWorker()
  }, [])
  return null
}
