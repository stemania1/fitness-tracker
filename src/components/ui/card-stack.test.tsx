// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { CardStack } from "./card-stack"

function Boom(): React.ReactElement {
  throw new Error("card blew up")
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  // React logs caught render errors; keep the suite output readable.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
  cleanup()
})

describe("CardStack", () => {
  it("renders each child", () => {
    render(
      <CardStack>
        <p>one</p>
        <p>two</p>
      </CardStack>
    )
    expect(screen.getByText("one")).toBeInTheDocument()
    expect(screen.getByText("two")).toBeInTheDocument()
  })

  it("isolates a throwing card so its siblings survive", () => {
    render(
      <CardStack>
        <p>before</p>
        <Boom />
        <p>after</p>
      </CardStack>
    )
    expect(screen.getByText("before")).toBeInTheDocument()
    expect(screen.getByText("after")).toBeInTheDocument()
  })

  it("skips null and false children, so conditional cards need no wrapper", () => {
    render(
      <CardStack>
        {null}
        {false}
        <p>only</p>
      </CardStack>
    )
    expect(screen.getByText("only")).toBeInTheDocument()
  })
})
