"use client"

import Link from "next/link"
import { User } from "lucide-react"

export function TopBar() {
  return (
    <header aria-label="Top bar" className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <Link href="/dashboard" className="text-lg font-bold text-purple-700">
        PF Tracker
      </Link>
      <Link
        href="/profile"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700 transition-colors hover:bg-purple-200"
      >
        <User className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Profile</span>
      </Link>
    </header>
  )
}
