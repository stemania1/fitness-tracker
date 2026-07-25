// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { MuscleMap } from "./MuscleMap"

const ACTIVE = "#7c3aed"

afterEach(cleanup)

describe("MuscleMap", () => {
  it("labels the muscles worked for screen readers", () => {
    const { container } = render(<MuscleMap groups={["chest", "triceps"]} />)
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe(
      "Muscles worked: chest, triceps",
    )
  })

  it("says none when no groups are given", () => {
    const { container } = render(<MuscleMap groups={[]} />)
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe(
      "Muscles worked: none",
    )
  })

  it("highlights active groups in the accent color", () => {
    const { container } = render(<MuscleMap groups={["chest"]} />)
    expect(container.querySelectorAll(`[fill="${ACTIVE}"]`).length).toBeGreaterThan(0)
  })

  it("highlights nothing when no groups are active", () => {
    const { container } = render(<MuscleMap groups={[]} />)
    expect(container.querySelectorAll(`[fill="${ACTIVE}"]`).length).toBe(0)
  })

  it("highlights every muscle for full_body", () => {
    const { container: partial } = render(<MuscleMap groups={["chest"]} />)
    const partialCount = partial.querySelectorAll(`[fill="${ACTIVE}"]`).length
    cleanup()
    const { container: full } = render(<MuscleMap groups={["full_body"]} />)
    const fullCount = full.querySelectorAll(`[fill="${ACTIVE}"]`).length
    expect(fullCount).toBeGreaterThan(partialCount)
  })

  it("passes through the className", () => {
    const { container } = render(<MuscleMap groups={[]} className="h-24 w-32" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toBe("h-24 w-32")
  })
})
