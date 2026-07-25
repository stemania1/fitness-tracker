// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ExerciseInfo } from "./ExerciseInfo"

afterEach(cleanup)

describe("ExerciseInfo", () => {
  it("hides the description until opened", () => {
    render(
      <ExerciseInfo exerciseId="seated-row-exercise" muscleGroups={["back"]} />,
    )
    expect(screen.queryByText(/horizontal back row/i)).not.toBeInTheDocument()
  })

  it("reveals the description when the panel is toggled open", async () => {
    const user = userEvent.setup()
    render(
      <ExerciseInfo exerciseId="seated-row-exercise" muscleGroups={["back"]} />,
    )
    await user.click(screen.getByRole("button", { name: /about this exercise/i }))
    expect(screen.getByText(/horizontal back row/i)).toBeInTheDocument()
    expect(screen.getByText(/Works:/i)).toBeInTheDocument()
  })

  it("shows rest guidance when a rest interval is given", async () => {
    const user = userEvent.setup()
    render(
      <ExerciseInfo
        exerciseId="seated-row-exercise"
        muscleGroups={["back"]}
        restSeconds={90}
      />,
    )
    await user.click(screen.getByRole("button", { name: /about this exercise/i }))
    expect(screen.getByText(/1m 30s/)).toBeInTheDocument()
    expect(screen.getByText(/timer starts automatically/i)).toBeInTheDocument()
  })

  it("omits rest guidance when there is no rest interval", async () => {
    const user = userEvent.setup()
    render(
      <ExerciseInfo exerciseId="plank" muscleGroups={["core"]} restSeconds={0} />,
    )
    await user.click(screen.getByRole("button", { name: /about this exercise/i }))
    expect(screen.queryByText(/timer starts automatically/i)).not.toBeInTheDocument()
  })

  it("still renders for an exercise with no stored description", async () => {
    const user = userEvent.setup()
    render(<ExerciseInfo exerciseId="unknown-move" muscleGroups={["chest"]} />)
    await user.click(screen.getByRole("button", { name: /about this exercise/i }))
    expect(screen.getByText(/Works:/i)).toBeInTheDocument()
  })
})
