"use client"

import type { LucideIcon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CARD_ACCENTS, type CardAccent } from "@/lib/constants"
import { cn } from "@/lib/utils"

export interface InsightCardProps {
  icon: LucideIcon
  /** Usually a string; a node for cards whose heading is itself interactive
   *  (the day-navigating cards put a <DayNav> here). */
  title: React.ReactNode
  /** Semantic accent for the icon. Most cards are `neutral` — see STYLE_GUIDE. */
  accent?: CardAccent
  /** Small explanatory line under the title. */
  subtitle?: string
  /** Right-hand header slot: a value readout, a metric toggle, a link. */
  action?: React.ReactNode
  isLoading?: boolean
  /** Height of the default loading skeleton, in Tailwind units (`h-*`). */
  skeletonHeight?: string
  /** Replaces the default skeleton entirely when the shape matters. */
  skeleton?: React.ReactNode
  /** Renders `empty` instead of children. Ignored while loading. */
  isEmpty?: boolean
  empty?: React.ReactNode
  /** Suppresses the whole card — for cards that hide until connected. */
  hidden?: boolean
  className?: string
  contentClassName?: string
  /** Spread onto CardContent — the day-navigating cards attach swipe handlers. */
  contentProps?: React.HTMLAttributes<HTMLDivElement>
  children?: React.ReactNode
}

/**
 * The standard card shell: accented icon, title, optional right-hand slot,
 * and a body that switches between loading / empty / content.
 *
 * This exact structure was retyped in twenty-six components — the same
 * `CardHeader className="pb-3"`, the same
 * `CardTitle className="flex items-center gap-2 text-base"`, and twenty-four
 * separate hand-rolled loading branches at inconsistent heights (h-40,
 * h-[180px], h-24, two stacked h-4s). Consistency was a matter of
 * discipline; now it is a matter of construction.
 *
 * Deliberately does *not* wrap children in an ErrorBoundary. The boundary
 * belongs outside the whole card component so it also catches throws from
 * that component's own hooks and derivations — a boundary in here would only
 * see the subtree it renders. Pages compose cards through `CardStack`, which
 * applies the boundary at the correct level and cannot be forgotten.
 */
export function InsightCard({
  icon: Icon,
  title,
  accent = "neutral",
  subtitle,
  action,
  isLoading = false,
  skeletonHeight = "h-24",
  skeleton,
  isEmpty = false,
  empty,
  hidden = false,
  className,
  contentClassName,
  contentProps,
  children,
}: InsightCardProps) {
  if (hidden) return null

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon
                className={cn("h-5 w-5 shrink-0", CARD_ACCENTS[accent])}
                aria-hidden="true"
              />
              {title}
            </CardTitle>
            {subtitle && (
              <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className={contentClassName} {...contentProps}>
        {isLoading ? (
          (skeleton ?? <Skeleton className={cn(skeletonHeight, "w-full")} />)
        ) : isEmpty ? (
          <div className="py-4 text-center text-sm text-gray-500">{empty}</div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
