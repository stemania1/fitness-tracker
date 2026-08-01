// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }))
vi.mock("next/navigation", () => ({ usePathname }))

import { BottomNav } from "./bottom-nav"

afterEach(() => {
  cleanup()
})

function renderAt(path: string) {
  usePathname.mockReturnValue(path)
  return render(<BottomNav />)
}

describe("BottomNav", () => {
  it("shows the five top-level destinations", () => {
    renderAt("/dashboard")
    const labels = screen
      .getAllByRole("link")
      .map((a) => a.textContent?.trim())
    expect(labels).toEqual([
      "Dashboard",
      "Workouts",
      "Log",
      "Insights",
      "Goals",
    ])
  })

  it("links Insights, which was previously reachable only from the dashboard", () => {
    renderAt("/dashboard")
    expect(screen.getByRole("link", { name: /insights/i })).toHaveAttribute(
      "href",
      "/insights"
    )
  })

  it("marks the current tab as the active page", () => {
    renderAt("/insights")
    expect(screen.getByRole("link", { name: /insights/i })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("leaves the other tabs unmarked", () => {
    renderAt("/insights")
    expect(
      screen.getByRole("link", { name: /goals/i })
    ).not.toHaveAttribute("aria-current")
  })

  it("treats a nested route as being on its tab", () => {
    renderAt("/workouts/abc-123")
    expect(screen.getByRole("link", { name: /workouts/i })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("marks nothing active on a route with no tab, such as /plan", () => {
    renderAt("/plan")
    const active = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page")
    expect(active).toHaveLength(0)
  })
})
