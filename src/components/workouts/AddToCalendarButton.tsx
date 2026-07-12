"use client"

import { useState } from "react"
import { CalendarPlus, Check } from "lucide-react"
import { buildTrainingIcs } from "@/lib/training-calendar"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** UTC DTSTAMP: YYYYMMDDTHHMMSSZ. */
function utcStamp(now: Date): string {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  )
}

/**
 * Downloads the 12-week plan as an .ics file. Opening it on a phone adds the
 * recurring sessions to the native calendar, which handles reminders — no
 * web-push needed, and it works reliably on iOS.
 */
export function AddToCalendarButton() {
  const [done, setDone] = useState(false)

  function handleClick() {
    const ics = buildTrainingIcs({ stamp: utcStamp(new Date()) })
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "pf-training-plan.ics"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setDone(true)
    setTimeout(() => setDone(false), 4000)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-4 py-2.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-50"
      >
        {done ? (
          <>
            <Check className="h-4 w-4" />
            Calendar file downloaded
          </>
        ) : (
          <>
            <CalendarPlus className="h-4 w-4" />
            Add training schedule to calendar
          </>
        )}
      </button>
      {done && (
        <p className="mt-2 text-center text-xs text-gray-500">
          Open the downloaded file to add your sessions (with 30-min reminders)
          to your phone&apos;s calendar.
        </p>
      )}
    </div>
  )
}
