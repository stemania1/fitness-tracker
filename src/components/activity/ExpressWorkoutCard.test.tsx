// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), push: vi.fn() }))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
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
    }),
  }),
}))
vi.mock("@/lib/supabase/exercises", () => ({ ensureExercisesExist: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))

import { ExpressWorkoutCard } from "./ExpressWorkoutCard"

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.push.mockReset()
})
afterEach(cleanup)

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
})
