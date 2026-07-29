"use client"

import { useCallback, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { saveWorkout } from "@/lib/save-workout"
import {
  listPending,
  removePending,
  localStorageQueue,
} from "@/lib/pending-workouts"
import { CloudOff, RefreshCw } from "lucide-react"

const supabase = createClient()

/**
 * Flushes workouts that were queued while offline. Runs on mount and whenever
 * the browser fires `online`, and shows a small pill while items are pending.
 * Mounted once in the dashboard layout.
 */
export function OfflineSyncManager() {
  const queryClient = useQueryClient()
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const flush = useCallback(async () => {
    const pending = listPending(localStorageQueue)
    setPendingCount(pending.length)
    if (pending.length === 0) return
    if (typeof navigator !== "undefined" && !navigator.onLine) return

    setSyncing(true)
    for (const p of pending) {
      try {
        await saveWorkout(supabase, p.payload)
        removePending(localStorageQueue, p.id)
      } catch {
        // Still failing (probably offline again) — keep it queued, retry later.
        break
      }
    }
    setPendingCount(listPending(localStorageQueue).length)
    setSyncing(false)
    // Refresh anything that reads workouts now that new ones landed.
    queryClient.invalidateQueries()
  }, [queryClient])

  useEffect(() => {
    flush()
    const onOnline = () => flush()
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [flush])

  if (pendingCount === 0) return null

  return (
    <div className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
      {syncing ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <CloudOff className="h-4 w-4" />
      )}
      {syncing
        ? "Syncing workouts…"
        : `${pendingCount} workout${pendingCount > 1 ? "s" : ""} waiting to sync`}
    </div>
  )
}
