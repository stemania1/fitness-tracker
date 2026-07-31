"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Link2, Unlink } from "lucide-react"
import {
  ouraErrorInfo,
  isOuraErrorReason,
  type OuraErrorReason,
} from "@/lib/oura-connect-errors"

const supabase = createClient()

/** Scopes the app needs. `ring_configuration` gates ring/device data,
 *  including the battery level behind the dashboard's battery pill. */
const OURA_SCOPE = "daily sleep heartrate personal spo2 stress ring_configuration"

export interface OuraFeedback {
  type: "success" | "error"
  text: string
}

interface OuraConnectionCardProps {
  /** Surfaced in the profile page's shared banner. */
  onFeedback: (feedback: OuraFeedback) => void
}

/**
 * Connect / disconnect the user's Oura Ring, and explain it when the OAuth
 * round trip fails.
 *
 * Self-fetching, like the dashboard cards: it owns the connected query, the
 * `?oura=` callback handling and the troubleshooting panel, so the profile
 * page doesn't carry three pieces of state and two handlers for a device
 * integration. Feedback goes out through a callback because the page owns the
 * single banner shared with the profile form.
 */
export function OuraConnectionCard({ onFeedback }: OuraConnectionCardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [errorReason, setErrorReason] = useState<OuraErrorReason | null>(null)
  /** The `?oura=` outcome is a one-shot event. Without this, any re-render
   *  that re-runs the effect re-applies it — which would resurrect a
   *  troubleshooting panel the user had just dismissed. */
  const handledOutcome = useRef<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const { data: connected, isLoading } = useQuery({
    queryKey: ["oura-connected"],
    queryFn: async () => {
      const res = await fetch("/api/oura")
      if (res.status === 404) return false
      return res.ok
    },
  })

  // The OAuth callback comes back to /profile with the outcome in the query
  // string; consume it and clean the URL so a refresh doesn't replay it.
  useEffect(() => {
    const outcome = searchParams.get("oura")
    if (!outcome) return
    const key = `${outcome}:${searchParams.get("oura_reason") ?? ""}`
    if (handledOutcome.current === key) return
    handledOutcome.current = key

    if (outcome === "connected") {
      onFeedback({ type: "success", text: "Oura Ring connected successfully!" })
      setErrorReason(null)
      queryClient.invalidateQueries({ queryKey: ["oura-connected"] })
      router.replace("/profile")
    } else if (outcome === "error") {
      const reason = searchParams.get("oura_reason") ?? ""
      setErrorReason(isOuraErrorReason(reason) ? reason : null)
      onFeedback({ type: "error", text: "Failed to connect Oura Ring." })
      router.replace("/profile")
    }
    // onFeedback is a fresh closure each render; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, queryClient, router])

  function connect() {
    const clientId = process.env.NEXT_PUBLIC_OURA_CLIENT_ID
    const redirectUri = `${window.location.origin}/api/auth/oura/callback`
    window.location.href =
      `https://cloud.ouraring.com/oauth/authorize?response_type=code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(OURA_SCOPE)}`
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      await (
        supabase as unknown as {
          from: (table: string) => {
            delete: () => { eq: (col: string, val: string) => Promise<unknown> }
          }
        }
      )
        .from("oura_tokens")
        .delete()
        .eq("user_id", user.id)
      queryClient.invalidateQueries({ queryKey: ["oura-connected"] })
      queryClient.invalidateQueries({ queryKey: ["oura-summary"] })
      onFeedback({ type: "success", text: "Oura Ring disconnected." })
    } catch {
      onFeedback({ type: "error", text: "Failed to disconnect Oura Ring." })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-purple-500" />
          Connected Devices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-gray-600"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Oura Ring</p>
              <p className="text-xs text-gray-500">
                {isLoading
                  ? "Checking..."
                  : connected
                    ? "Connected — syncing sleep, activity & readiness"
                    : "Connect to sync sleep, activity & heart rate data"}
              </p>
            </div>
          </div>
          {connected ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={disconnect}
              disabled={disconnecting}
              className="shrink-0 gap-1.5"
            >
              <Unlink className="h-3.5 w-3.5" />
              {disconnecting ? "..." : "Disconnect"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setErrorReason(null)
                connect()
              }}
              className="shrink-0 gap-1.5"
            >
              <Link2 className="h-3.5 w-3.5" />
              Connect
            </Button>
          )}
        </div>

        {errorReason && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-800">
                  {ouraErrorInfo[errorReason].title}
                </p>
                <p className="text-xs font-medium text-amber-700">
                  Troubleshooting steps:
                </p>
                <ol className="list-decimal space-y-1 pl-4 text-xs text-amber-700">
                  {ouraErrorInfo[errorReason].steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={() => setErrorReason(null)}
                  className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 underline hover:text-amber-800"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
