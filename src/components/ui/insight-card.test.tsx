// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { Flame } from "lucide-react"
import { InsightCard } from "./insight-card"
import { CARD_ACCENTS } from "@/lib/constants"

afterEach(() => {
  cleanup()
})

describe("InsightCard", () => {
  it("renders the title and children", () => {
    render(
      <InsightCard icon={Flame} title="This Week">
        <p>body</p>
      </InsightCard>
    )
    expect(screen.getByText("This Week")).toBeInTheDocument()
    expect(screen.getByText("body")).toBeInTheDocument()
  })

  it("defaults to the neutral accent", () => {
    const { container } = render(<InsightCard icon={Flame} title="T" />)
    const icon = container.querySelector("svg")
    expect(icon?.getAttribute("class")).toContain(CARD_ACCENTS.neutral)
  })

  it("applies the requested accent token", () => {
    const { container } = render(
      <InsightCard icon={Flame} title="T" accent="progress" />
    )
    const icon = container.querySelector("svg")
    expect(icon?.getAttribute("class")).toContain(CARD_ACCENTS.progress)
  })

  it("hides the icon from assistive tech — the title carries the name", () => {
    const { container } = render(<InsightCard icon={Flame} title="T" />)
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    )
  })

  it("shows a skeleton instead of children while loading", () => {
    render(
      <InsightCard icon={Flame} title="T" isLoading>
        <p>body</p>
      </InsightCard>
    )
    expect(screen.queryByText("body")).not.toBeInTheDocument()
  })

  it("prefers a custom skeleton when given one", () => {
    render(
      <InsightCard
        icon={Flame}
        title="T"
        isLoading
        skeleton={<p>loading rows</p>}
      >
        <p>body</p>
      </InsightCard>
    )
    expect(screen.getByText("loading rows")).toBeInTheDocument()
    expect(screen.queryByText("body")).not.toBeInTheDocument()
  })

  it("shows the empty state instead of children when empty", () => {
    render(
      <InsightCard icon={Flame} title="T" isEmpty empty="Nothing yet">
        <p>body</p>
      </InsightCard>
    )
    expect(screen.getByText("Nothing yet")).toBeInTheDocument()
    expect(screen.queryByText("body")).not.toBeInTheDocument()
  })

  it("lets loading win over empty, so an empty flash can't precede data", () => {
    render(
      <InsightCard
        icon={Flame}
        title="T"
        isLoading
        isEmpty
        empty="Nothing yet"
        skeleton={<p>loading</p>}
      />
    )
    expect(screen.getByText("loading")).toBeInTheDocument()
    expect(screen.queryByText("Nothing yet")).not.toBeInTheDocument()
  })

  it("renders the subtitle and the action slot", () => {
    render(
      <InsightCard
        icon={Flame}
        title="T"
        subtitle="last 30 days"
        action={<button>View all</button>}
      />
    )
    expect(screen.getByText("last 30 days")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "View all" })).toBeInTheDocument()
  })

  it("omits the action wrapper when the slot is falsy", () => {
    // Cards pass `loading && value && (...)`, which is `false` before data.
    render(<InsightCard icon={Flame} title="T" action={false} />)
    expect(screen.getByText("T")).toBeInTheDocument()
  })

  it("renders nothing when hidden", () => {
    const { container } = render(
      <InsightCard icon={Flame} title="T" hidden>
        <p>body</p>
      </InsightCard>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("accepts a node as the title, for the day-navigating cards", () => {
    render(<InsightCard icon={Flame} title={<button>Prev</button>} />)
    expect(screen.getByRole("button", { name: "Prev" })).toBeInTheDocument()
  })
})
