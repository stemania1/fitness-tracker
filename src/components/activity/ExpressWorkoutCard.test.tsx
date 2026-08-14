// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  push: vi.fn(),
  ensureExercisesExist: vi.fn(),
  insertTemplateExercises: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === "workout_templates") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: "tpl-1" }, error: null }),
            }),
          }),
        }
      }
      if (table === "template_exercises") {
        return { insert: mocks.insertTemplateExercises }
      }
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  primary_goal: "general_fitness",
                  fitness_level: "beginner",
                  limitations: null,
                  age: null,
                },
                error: null,
              }),
          }),
        }),
      }
    },
  }),
}))
vi.mock("@/lib/supabase/exercises", () => ({
  ensureExercisesExist: mocks.ensureExercisesExist,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))

import { ExpressWorkoutCard } from "./ExpressWorkoutCard"

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.push.mockReset()
  // Every generated exercise id maps to itself as a database id.
  mocks.ensureExercisesExist
    .mockReset()
    .mockImplementation(async (_client: unknown, ids: string[]) =>
      new Map(ids.map((id) => [id, id]))
    )
  mocks.insertTemplateExercises
    .mockReset()
    .mockResolvedValue({ error: null })
})
afterEach(cleanup)

/** Generate a circuit and return its collapsed exercise rows. */
async function generate(minutes: number) {
  render(wrap(<ExpressWorkoutCard />))
  await screen.findByRole("button", { name: `${minutes} min` })
  fireEvent.click(screen.getByRole("button", { name: `${minutes} min` }))
  await waitFor(() =>
    expect(
      screen.getByText(new RegExp(`Express ${minutes}-Minute Circuit`))
    ).toBeInTheDocument()
  )
  // The circuit rows are the only collapsed disclosures in the card.
  return screen.getAllByRole("button", { expanded: false })
}

describe("ExpressWorkoutCard", () => {
  it("offers time options and generates a fitting circuit", async () => {
    render(wrap(<ExpressWorkoutCard />))
    // Wait for the profile query to settle so generation uses it.
    await screen.findByRole("button", { name: "15 min" })
    fireEvent.click(screen.getByRole("button", { name: "15 min" }))
    await waitFor(() =>
      expect(screen.getByText(/Express 15-Minute Circuit/)).toBeInTheDocument()
    )
    // At least a couple of exercises, and a save action.
    expect(
      screen.getByRole("button", { name: /Save to my workouts/i })
    ).toBeInTheDocument()
  })

  it("regenerates for a different budget", async () => {
    render(wrap(<ExpressWorkoutCard />))
    await screen.findByRole("button", { name: "30 min" })
    fireEvent.click(screen.getByRole("button", { name: "30 min" }))
    await waitFor(() =>
      expect(screen.getByText(/Express 30-Minute Circuit/)).toBeInTheDocument()
    )
  })

  it("expands a circuit row into the exercise's diagram and description", async () => {
    const rows = await generate(30)
    expect(rows.length).toBeGreaterThan(0)
    // Collapsed: no info panel yet.
    expect(screen.queryByText(/^Works:/)).not.toBeInTheDocument()

    fireEvent.click(rows[0])

    expect(screen.getByRole("button", { expanded: true })).toBe(rows[0])
    // The muscle map (and, for strength lifts, the position drawings) are SVGs.
    expect(screen.getAllByRole("img").length).toBeGreaterThan(0)
    expect(screen.getByText(/^Works:/)).toBeInTheDocument()
  })

  it("opens one row at a time", async () => {
    const rows = await generate(30)
    fireEvent.click(rows[0])
    fireEvent.click(rows[1])
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1)
    expect(screen.getByRole("button", { expanded: true })).toBe(rows[1])
  })

  it("collapses an open row when the circuit is reshuffled", async () => {
    const rows = await generate(30)
    fireEvent.click(rows[0])
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Reshuffle" }))
    expect(
      screen.queryByRole("button", { expanded: true })
    ).not.toBeInTheDocument()
  })

  it("starts the circuit in the logger so the session gets tracked", async () => {
    await generate(30)
    fireEvent.click(
      screen.getByRole("button", { name: /Start & log this workout/i })
    )
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/activity/log?template=tpl-1")
    )
  })

  it("saves without starting when asked to save for later", async () => {
    await generate(30)
    fireEvent.click(
      screen.getByRole("button", { name: /Save to my workouts/i })
    )
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/workouts"))
  })
})
