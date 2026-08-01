"use client"

import Link from "next/link"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"
import { CONTENT_COLUMN } from "@/components/layout/shell"

export function TopBar() {
  return (
    /* A flex child of the shell rather than `sticky` — the shell itself never
       scrolls, so the bar is always on screen. The top padding clears the
       status bar, which `viewport-fit: cover` + the translucent status bar
       style let the web view draw underneath. */
    <header aria-label="Top bar" className="z-10 shrink-0 border-b border-gray-200 bg-white px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className={cn(CONTENT_COLUMN, "flex items-center justify-between")}>
        <Link href="/dashboard" className="text-lg font-bold">
          <span className="text-gray-900">Craig</span>
          <span className="text-purple-700">Fitness</span>
        </Link>
        <Link
          href="/profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700 transition-colors hover:bg-purple-200"
        >
          <User className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Profile</span>
        </Link>
      </div>
    </header>
  )
}
