// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react"
import { describe, it, expect, afterEach } from "vitest"
import { ExercisePositions } from "./ExercisePositions"

afterEach(cleanup)

describe("ExercisePositions", () => {
  it("draws two positions for a movement", () => {
    render(<ExercisePositions exerciseId="dumbbell-goblet-squat" />)
    expect(screen.getByRole("img", { name: /start position/i })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /end position/i })).toBeInTheDocument()
  })

  it("labels the positions with what the lifter does", () => {
    render(<ExercisePositions exerciseId="dumbbell-goblet-squat" />)
    expect(screen.getByRole("img", { name: /start position: stand/i })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /end position: sit back/i })).toBeInTheDocument()
  })

  it("uses pattern-specific wording, not a generic start/end", () => {
    render(<ExercisePositions exerciseId="pull-up" />)
    expect(screen.getByRole("img", { name: /start position: hang/i })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /end position: pull up/i })).toBeInTheDocument()
  })

  // A plank's two positions are the same shape, so showing both is noise.
  it("draws a single position for a static hold", () => {
    render(<ExercisePositions exerciseId="plank" />)
    expect(screen.getByRole("img", { name: /hold position/i })).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: /start position/i })).toBeNull()
  })

  it("renders nothing where a diagram wouldn't help", () => {
    const { container } = render(<ExercisePositions exerciseId="treadmill-run" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing for an unknown exercise", () => {
    const { container } = render(<ExercisePositions exerciseId="nope" />)
    expect(container).toBeEmptyDOMElement()
  })

  // Every exercise sharing a pattern inherits the drawing.
  it("gives the same drawing to different loads of one pattern", () => {
    render(<ExercisePositions exerciseId="leg-press-exercise" />)
    expect(screen.getByRole("img", { name: /start position: stand/i })).toBeInTheDocument()
  })
})
