"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/types/database"
import {
  isPushSupported,
  isPushSubscribed,
  enablePush,
  disablePush,
} from "@/lib/push-client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectOption } from "@/components/ui/select"
import { Bell } from "lucide-react"
import type { ReminderType } from "@/lib/reminders"
import {
  REMINDER_TYPES,
  REMINDER_TYPE_LABELS,
  type ReminderSettings,
} from "@/lib/reminder-settings"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { CARD_ACCENTS } from "@/lib/constants"

const supabase = createClient()

/** 0-23 → friendly clock time, e.g. 22 → "10 PM". */
function formatHour(h: number): string {
  const period = h < 12 ? "AM" : "PM"
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display} ${period}`
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-purple-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

/**
 * Profile control for the in-app reminders: master switch, per-category
 * toggles, and quiet hours. Each change persists immediately to the profile.
 */
export function ReminderSettingsCard({ initial }: { initial: ReminderSettings }) {
  const [settings, setSettings] = useState<ReminderSettings>(initial)
  const queryClient = useQueryClient()

  // Web-push state (browser capability + current subscription).
  const [pushSupported, setPushSupported] = useState(false)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  useEffect(() => {
    setPushSupported(isPushSupported())
    isPushSubscribed()
      .then(setPushOn)
      .catch(() => {})
  }, [])

  async function togglePush(next: boolean) {
    setPushBusy(true)
    setPushError(null)
    setTestResult(null)
    try {
      if (next) await enablePush()
      else await disablePush()
      setPushOn(next)
    } catch (e) {
      setPushError((e as Error).message)
    } finally {
      setPushBusy(false)
    }
  }

  // One-tap end-to-end delivery check (see /api/push/test).
  const [testBusy, setTestBusy] = useState(false)
  const [testResult, setTestResult] = useState<
    { ok: true } | { ok: false; message: string } | null
  >(null)

  async function sendTest() {
    setTestBusy(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/push/test", { method: "POST" })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        setTestResult({
          ok: false,
          message: body.error ?? "Couldn't send the test notification.",
        })
      } else {
        setTestResult({ ok: true })
      }
    } catch {
      setTestResult({ ok: false, message: "Network error — try again." })
    } finally {
      setTestBusy(false)
    }
  }

  const mutation = useMutation({
    mutationFn: async (next: ReminderSettings) => {
      const userId = await getAuthUserId()
      const { error } = await supabase
        .from("user_profiles")
        // ReminderSettings is JSON-serializable but lacks an index signature,
        // so cast to the column's Json type.
        .update({ reminder_settings: next as unknown as Json })
        .eq("id", userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
  })

  function persist(next: ReminderSettings) {
    setSettings(next)
    mutation.mutate(next)
  }

  const quietOn = settings.quietStartHour != null && settings.quietEndHour != null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className={`h-5 w-5 ${CARD_ACCENTS.neutral}`} />
          Reminders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Master switch */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">In-app reminders</p>
            <p className="text-xs text-gray-500">
              Gentle nudges on the dashboard for anything you haven&apos;t logged.
            </p>
          </div>
          <Toggle
            label="Enable reminders"
            checked={settings.enabled}
            onChange={(v) => persist({ ...settings, enabled: v })}
          />
        </div>

        {/* Per-category toggles */}
        <div className="space-y-3">
          {REMINDER_TYPES.map((t: ReminderType) => (
            <div key={t} className="flex items-center justify-between">
              <span
                className={`text-sm ${
                  settings.enabled ? "text-gray-700" : "text-gray-400"
                }`}
              >
                {REMINDER_TYPE_LABELS[t]}
              </span>
              <Toggle
                label={REMINDER_TYPE_LABELS[t]}
                checked={settings.types[t]}
                disabled={!settings.enabled}
                onChange={(v) =>
                  persist({
                    ...settings,
                    types: { ...settings.types, [t]: v },
                  })
                }
              />
            </div>
          ))}
        </div>

        {/* Quiet hours */}
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Quiet hours</p>
              <p className="text-xs text-gray-500">
                No reminders during this window.
              </p>
            </div>
            <Toggle
              label="Enable quiet hours"
              checked={quietOn}
              disabled={!settings.enabled}
              onChange={(v) =>
                persist({
                  ...settings,
                  quietStartHour: v ? 22 : null,
                  quietEndHour: v ? 7 : null,
                })
              }
            />
          </div>

          {quietOn && settings.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="quiet-start" className="text-xs">
                  From
                </Label>
                <Select
                  id="quiet-start"
                  value={settings.quietStartHour ?? 22}
                  onChange={(e) =>
                    persist({ ...settings, quietStartHour: parseInt(e.target.value, 10) })
                  }
                >
                  {HOURS.map((h) => (
                    <SelectOption key={h} value={h}>
                      {formatHour(h)}
                    </SelectOption>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="quiet-end" className="text-xs">
                  Until
                </Label>
                <Select
                  id="quiet-end"
                  value={settings.quietEndHour ?? 7}
                  onChange={(e) =>
                    persist({ ...settings, quietEndHour: parseInt(e.target.value, 10) })
                  }
                >
                  {HOURS.map((h) => (
                    <SelectOption key={h} value={h}>
                      {formatHour(h)}
                    </SelectOption>
                  ))}
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Push notifications */}
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <div className="pr-3">
              <p className="text-sm font-medium text-gray-900">
                Push notifications
              </p>
              <p className="text-xs text-gray-500">
                {pushSupported
                  ? "Get a nudge on your phone even when the app is closed."
                  : "Not available on this browser. On iPhone, add the app to your Home Screen first."}
              </p>
            </div>
            <Toggle
              label="Enable push notifications"
              checked={pushOn}
              disabled={!pushSupported || !settings.enabled || pushBusy}
              onChange={togglePush}
            />
          </div>
          {pushError && <p className="text-sm text-red-600">{pushError}</p>}

          {/* End-to-end delivery check, shown once push is on. */}
          {pushOn && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={sendTest}
                disabled={testBusy}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {testBusy ? "Sending…" : "Send test notification"}
              </button>
              {testResult?.ok && (
                <p className="text-sm text-emerald-600">
                  Sent — you should see it on your device in a moment.
                </p>
              )}
              {testResult && !testResult.ok && (
                <p className="text-sm text-red-600">{testResult.message}</p>
              )}
            </div>
          )}
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600">
            Couldn&apos;t save — {(mutation.error as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
