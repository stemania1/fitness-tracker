"use client"

/**
 * Saving a finished workout: auth check, payload build, save, and the
 * park-on-failure queue discipline. Extracted from the log page; payload
 * construction, the offline heuristic and the error copy stay in
 * lib/finish-workout (pure + tested) — this owns only the IO and the
 * navigation that follows it.
 */

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { saveWorkout } from "@/lib/save-workout"
import { invalidateWorkoutData } from "@/lib/queries/invalidate"
import {
  buildWorkoutPayload,
  isOfflineError,
  saveErrorMessage,
} from "@/lib/finish-workout"
import {
  addPending,
  removePending,
  localStorageQueue,
} from "@/lib/pending-workouts"
import type { ActiveWorkout } from "@/lib/active-workout"
import type { AppendInfo } from "./useWorkoutInit"

export function useFinishWorkout(
  workout: ActiveWorkout | null,
  appendInfo: React.MutableRefObject<AppendInfo | null>
) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  /**
   * Queue entry holding this session after a failed save, so a later success
   * (or another failure) can replace it instead of stacking duplicates.
   */
  const parkedId = useRef<string | null>(null)

  const finishWorkout = useCallback(async () => {
    if (!workout || workout.exercises.length === 0) return
    setSaving(true)
    setFinishError(null)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setFinishError("You're signed out — sign in again to save.")
      return
    }

    const payload = buildWorkoutPayload({
      workout,
      userId: user.id,
      finishedAt: new Date(),
      append: appendInfo.current,
    })

    try {
      const logId = await saveWorkout(supabase, payload)
      // An earlier attempt may have parked this session in the queue. It has
      // landed now, so drop that copy before OfflineSyncManager replays it into
      // a duplicate workout.
      if (parkedId.current) {
        removePending(localStorageQueue, parkedId.current)
        parkedId.current = null
      }
      // Everything derived from workouts — This Week's count and streak,
      // calories burned, recent workouts, PRs — was served from cache until
      // it happened to expire. Refresh before navigating away.
      invalidateWorkoutData(queryClient)
      router.push(`/activity/${logId}`)
    } catch (err) {
      // Park the session on *every* failure, not just connectivity ones.
      // Previously a server-side rejection left the workout in component state
      // and nowhere else: the banner invited a retry, but closing the tab or
      // tapping away threw the session out with no queue entry and no trace.
      // That is the same invisibility that cost a Cooper test its workout row.
      //
      // Replace rather than append, so repeated retries leave one entry
      // carrying the latest payload instead of a pile of near-duplicates.
      if (parkedId.current) removePending(localStorageQueue, parkedId.current)
      const id = crypto.randomUUID()
      addPending(localStorageQueue, {
        id,
        queuedAt: new Date().toISOString(),
        payload,
      })
      parkedId.current = id

      if (isOfflineError(err)) {
        // Nothing useful to say — it syncs when the signal comes back.
        router.push("/dashboard?queued=1")
      } else {
        // Stay put so the user can retry immediately; the queue is the safety
        // net for when they don't.
        setSaving(false)
        setFinishError(saveErrorMessage(err))
      }
    }
  }, [workout, appendInfo, queryClient, router])

  return { finishWorkout, saving, finishError }
}
