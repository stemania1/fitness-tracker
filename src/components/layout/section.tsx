import { CardStack } from "@/components/ui/card-stack"

/**
 * A labelled group of cards, so a page reads as sections rather than a wall.
 *
 * Children render through CardStack, so every card in a section is isolated
 * behind its own ErrorBoundary without each page having to remember.
 *
 * Lived privately in the Insights page while the dashboard — the page that
 * needed it most, at twelve ungrouped cards — went without.
 *
 * `subtitle` is optional: Insights uses it to explain what each group is for,
 * the dashboard's groups are self-evident from their titles.
 */
export function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      <CardStack>{children}</CardStack>
    </section>
  )
}
