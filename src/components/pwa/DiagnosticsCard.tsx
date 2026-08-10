"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bug, CheckCircle2, AlertTriangle } from "lucide-react"
import { isViewportDebugOn, setViewportDebug } from "@/lib/viewport-debug-flag"
import {
  readReceivedPushes,
  deliveryLagMs,
  formatLag,
  type ReceivedPush,
} from "@/lib/push/received-log"

/** Device-side facts the server can't see. */
interface DeviceState {
  permission: string
  controlled: boolean
  updatePending: boolean
  standalone: boolean
  /** Tail of this browser's push endpoint, or null if it isn't subscribed. */
  endpointTail: string | null
}

async function readDeviceState(): Promise<DeviceState> {
  const permission =
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  let controlled = false
  let updatePending = false
  let endpointTail: string | null = null
  if ("serviceWorker" in navigator) {
    controlled = !!navigator.serviceWorker.controller
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      updatePending = !!reg?.waiting
      // The endpoint is a capability URL, so only the tail is shown — enough
      // to check this browser against the rows stored server-side. A device
      // receiving pushes addressed to an endpoint it no longer holds is the
      // shape of a second, forgotten subscription.
      const sub = await reg?.pushManager.getSubscription()
      if (sub) endpointTail = sub.endpoint.slice(-8)
    } catch {
      // Leave the defaults; the panel must not throw.
    }
  }
  return { permission, controlled, updatePending, standalone, endpointTail }
}

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
  const [device, setDevice] = useState<DeviceState | null>(null)
  const [received, setReceived] = useState<ReceivedPush[]>([])

  // Read after mount: localStorage isn't available during SSR.
  useEffect(() => {
    setOn(isViewportDebugOn(""))
  }, [])

  useEffect(() => {
    let cancelled = false
    void readDeviceState().then((d) => {
      if (!cancelled) setDevice(d)
    })
    void readReceivedPushes().then((r) => {
      if (!cancelled) setReceived(r)
    })
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

        {device && (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <p className="font-medium text-gray-900">This device</p>
            <p className="mt-1">
              Notifications {device.permission} · service worker{" "}
              {device.controlled ? "active" : "not controlling this page"}
              {device.updatePending ? " · update pending" : ""}
            </p>
            <p className="mt-0.5 opacity-75">
              {device.standalone
                ? "Running as an installed app."
                : "Running in a browser tab — iOS only delivers push to the installed app."}
            </p>
            {device.endpointTail && (
              <p className="mt-0.5 font-mono opacity-75">
                endpoint …{device.endpointTail}
              </p>
            )}
            {/* iOS gives the web no way to see Focus / Do Not Disturb, and it
                silences banners for a push that was delivered successfully. */}
            <p className="mt-1 opacity-75">
              If everything here looks right but nothing arrives, check
              Settings → Focus and Settings → Notifications → CraigFitness.
            </p>
          </div>
        )}

        {/* The payload is the only artifact that survives a wrong
            notification, and until now it was read once off a lock screen and
            gone. Every entry here answers the two questions that took longest:
            how late it arrived, and which database produced it. */}
        {received.length > 0 && (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <p className="font-medium text-gray-900">Notifications received</p>
            <ul className="mt-1 space-y-2">
              {received.map((r) => (
                <li key={r.receivedAt} className="border-l-2 border-gray-200 pl-2">
                  <p className="whitespace-pre-line text-gray-900">
                    {r.body || "(no body)"}
                  </p>
                  <p className="mt-0.5 opacity-75">
                    {new Date(r.receivedAt).toLocaleString()}
                    {r.shown ? "" : " · dropped as stale"}
                  </p>
                  <p className="font-mono opacity-75">
                    built {r.builtAt ? formatLag(deliveryLagMs(r)) + " earlier" : "unstamped"}
                    {r.source ? ` · ${r.source}` : " · no source"}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 opacity-75">
              An unstamped payload, or one whose source names a database you
              don&apos;t recognise, did not come from this app&apos;s cron.
            </p>
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
