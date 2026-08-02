"use client"

import { useCallback, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { saveWorkout } from "@/lib/save-workout"
import {
  listPending,
  removePending,
  markAttempt,
  stuckPending,
  isStuck,
  localStorageQueue,
} from "@/lib/pending-workouts"
import { isOfflineError, saveErrorMessage } from "@/lib/finish-workout"
import { CloudOff, RefreshCw, AlertTriangle } from "lucide-react"

const supabase = createClient()

/**
 * Flushes workouts that failed to save. Runs on mount and whenever the browser
 * fires `online`, and shows a small pill while items are pending.
 * Mounted once in the dashboard layout.
 *
 * The queue holds two kinds of entry now that non-connectivity failures are
 * parked too, and they need opposite handling. An offline failure means stop —
 * nothing else will save either. A rejection means skip and carry on, because
 * the old code `break`ing on any error let one bad payload block every good
 * workout behind it indefinitely.
 */
export function OfflineSyncManager() {
  const queryClient = useQueryClient()
  const [pendingCount, setPendingCount] = useState(0)
  const [stuckCount, setStuckCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const refreshCounts = useCallback(() => {
    setPendingCount(listPending(localStorageQueue).length)
    setStuckCount(stuckPending(localStorageQueue).length)
  }, [])

  const flush = useCallback(
    async (includeStuck = false) => {
      const pending = listPending(localStorageQueue)
      refreshCounts()
      if (pending.length === 0) return
      if (typeof navigator !== "undefined" && !navigator.onLine) return

      setSyncing(true)
      let landed = false
      for (const p of pending) {
        // Entries the server keeps rejecting are left alone on the automatic
        // pass — retrying them every mount just repeats a known answer. The
        // pill's Retry button passes `includeStuck` to force one.
        if (!includeStuck && isStuck(p)) continue
        try {
          await saveWorkout(supabase, p.payload)
          removePending(localStorageQueue, p.id)
          landed = true
        } catch (err) {
          if (isOfflineError(err)) break
          markAttempt(localStorageQueue, p.id, saveErrorMessage(err))
        }
      }
      refreshCounts()
      setSyncing(false)
      // Refresh anything that reads workouts, but only if one actually landed —
      // a pass that saved nothing has no reason to blow the whole cache.
      if (landed) queryClient.invalidateQueries()
    },
    [queryClient, refreshCounts]
  )

  useEffect(() => {
    flush()
    const onOnline = () => flush()
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [flush])

  if (pendingCount === 0) return null

  const discardStuck = () => {
    for (const p of stuckPending(localStorageQueue)) {
      removePending(localStorageQueue, p.id)
    }
    setConfirmingDiscard(false)
    refreshCounts()
  }

  const stuck = stuckCount > 0 && !syncing

  return (
    <div
      role="status"
      className={`fixed bottom-[calc(var(--bottom-nav-h)+0.75rem)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${
        stuck ? "bg-red-700" : "bg-gray-900"
      }`}
    >
      {syncing ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : stuck ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <CloudOff className="h-4 w-4" />
      )}

      {syncing
        ? "Syncing workouts…"
        : stuck
          ? `${stuckCount} workout${stuckCount > 1 ? "s" : ""} couldn't sync`
          : `${pendingCount} workout${pendingCount > 1 ? "s" : ""} waiting to sync`}

      {stuck && (
        <>
          <button
            type="button"
            onClick={() => flush(true)}
            className="ml-1 min-h-[44px] rounded-full px-2 underline underline-offset-2"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() =>
              confirmingDiscard ? discardStuck() : setConfirmingDiscard(true)
            }
            className="min-h-[44px] rounded-full px-2 underline underline-offset-2"
          >
            {confirmingDiscard ? "Sure?" : "Discard"}
          </button>
        </>
      )}
    </div>
  )
}
