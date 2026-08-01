"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Dumbbell,
  ClipboardList,
  Target,
  LineChart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CONTENT_COLUMN } from "@/components/layout/shell"

/**
 * Five tabs is the practical limit on a phone, so this is a zero-sum list.
 *
 * Insights replaced Plan. Insights holds twelve analytical cards and was
 * reachable only via a text link below every card on the dashboard — a lot of
 * built surface behind a link most people never scroll to. Plan is a fixed
 * 12-week view you consult occasionally rather than weekly, and it stays
 * reachable at /plan via the Today's Plan card, which now sits in the
 * dashboard's Today section rather than halfway down the page.
 */
const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/activity", label: "Log", icon: ClipboardList },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/goals", label: "Goals", icon: Target },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    /* Laid out in flow as the shell's last flex child — deliberately NOT
       `position: fixed`, which iOS strands mid-screen after the keyboard
       opens and closes. See the note in globals.css. */
    <nav aria-label="Main navigation" className="z-10 shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className={cn(CONTENT_COLUMN, "flex items-center justify-around py-2")}>
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                // min-h-11 is the 44px tap target the style guide asks for; py-1 alone
                // left these at ~36px, which is the single worst offender in an app
                // meant to be used one-handed at the gym.
                "flex min-h-11 flex-col items-center justify-center gap-0.5 px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "text-purple-600" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
