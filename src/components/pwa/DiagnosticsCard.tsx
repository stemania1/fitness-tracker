"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bug, CheckCircle2, AlertTriangle } from "lucide-react"
import { isViewportDebugOn, setViewportDebug } from "@/lib/viewport-debug-flag"

interface PushStatus {
  subscriptions: number
  timezone: string | null
  lastPushSentOn: string | null
  verdict: string
  ok: boolean
}

/**
 * Self-service diagnostics, so answering "why isn't this working" doesn't mean
 * reading server logs.
 *
 * Push status names the actual failure: the scheduled sender skips anyone with
 * no stored timezone, and nothing in the UI ever said so — the test-notification
 * button kept reporting success because that path needs no timezone.
 *
 * The viewport toggle is the only route to the readout in an installed PWA,
 * which launches at the manifest's `start_url` with no address bar to type
 * `?debug=viewport` into, and keeps storage separate from the browser that
 * installed it — the mode where the layout bugs actually reproduce.
 */
export function DiagnosticsCard() {
  const [on, setOn] = useState(false)
  const [push, setPush] = useState<PushStatus | null>(null)

  // Read after mount: localStorage isn't available during SSR.
  useEffect(() => {
    setOn(isViewportDebugOn(""))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/push/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setPush(d as PushStatus)
      })
      .catch(() => {
        // A diagnostics panel must never break the page it sits on.
      })
    return () => {
      cancelled = true
    }
  }, [])

  function toggle(next: boolean) {
    setOn(next)
    setViewportDebug(next)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bug className="h-5 w-5 text-purple-500" />
          Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {push && (
          <div
            className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
              push.ok
                ? "bg-emerald-50 text-emerald-900"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            {push.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="font-medium">Push status</p>
              <p>{push.verdict}</p>
              <p className="mt-1 opacity-75">
                {push.subscriptions} device
                {push.subscriptions === 1 ? "" : "s"} · timezone{" "}
                {push.timezone ?? "not set"}
                {push.lastPushSentOn ? ` · last sent ${push.lastPushSentOn}` : ""}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="text-sm font-medium text-gray-900">
              Viewport readout
            </p>
            <p className="text-xs text-gray-500">
              Shows a small overlay with the screen measurements behind layout
              bugs. Leave off unless asked.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Viewport readout"
            onClick={() => toggle(!on)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              on ? "bg-purple-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                on ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
