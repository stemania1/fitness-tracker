"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bug } from "lucide-react"
import { isViewportDebugOn, setViewportDebug } from "@/lib/viewport-debug-flag"

/**
 * Turns the viewport readout on from inside the app.
 *
 * This is the only way to reach it in an installed PWA: it launches at the
 * manifest's `start_url`, has no address bar to type `?debug=viewport` into,
 * and its storage is separate from the browser that installed it — so the
 * query-string switch was unusable in exactly the mode where the layout bugs
 * reproduce.
 */
export function DiagnosticsCard() {
  const [on, setOn] = useState(false)

  // Read after mount: localStorage isn't available during SSR.
  useEffect(() => {
    setOn(isViewportDebugOn(""))
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
      <CardContent>
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
