"use client"

import { Children } from "react"
import { ErrorBoundary } from "@/components/ui/error-boundary"

/**
 * A vertical run of cards, each isolated behind its own ErrorBoundary.
 *
 * The dashboard and Insights pages hand-wrapped every single card:
 * twenty-five `<ErrorBoundary>` elements whose only job was to stop one
 * card's failure taking the page with it. Wrapping here makes that
 * structural — a card added to a stack cannot be added without its
 * boundary.
 *
 * The boundary sits outside each card component (rather than inside the
 * card shell) so it also catches throws from the component's own hooks and
 * derivations, not just the subtree it renders.
 */
export function CardStack({
  children,
  className = "space-y-3",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {Children.map(children, (child) =>
        child == null || child === false ? null : (
          <ErrorBoundary>{child}</ErrorBoundary>
        )
      )}
    </div>
  )
}
