// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

type SbResponse = { data: unknown; error: unknown }

function makeBuilder(response: SbResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}
  b.select = () => b
  b.eq = () => b
  b.order = () => b
  b.limit = () => b
  b.then = (
    onFulfilled: (value: SbResponse) => unknown,
    onRejected: (reason: unknown) => unknown
  ) => Promise.resolve(response).then(onFulfilled, onRejected)
  return b
}

const script = vi.hoisted(() => ({ current: { data: null } as SbResponse }))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: () => makeBuilder(script.current),
  }),
}))

import { RecentWorkoutsCard } from "./RecentWorkoutsCard"

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

afterEach(() => {
  cleanup()
  script.current = { data: null, error: null }
})

describe("RecentWorkoutsCard", () => {
  it("lists recent workouts with dates and a link to each log", async () => {
    script.current = {
      data: [
        { id: "w1", name: "Push Day", started_at: "2026-01-05T09:00:00Z", duration_mins: 45 },
        { id: "w2", name: "Leg Day", started_at: "2026-01-03T09:00:00Z", duration_mins: null },
      ],
      error: null,
    }
    render(<RecentWorkoutsCard />, { wrapper })

    await waitFor(() => expect(screen.getByText("Push Day")).toBeInTheDocument())
    expect(screen.getByText("Leg Day")).toBeInTheDocument()
    expect(screen.getByText(/45 min/)).toBeInTheDocument()
    const link = screen.getByText("Push Day").closest("a")
    expect(link).toHaveAttribute("href", "/activity/w1")
  })

  it("shows the empty state when there are no workouts", async () => {
    script.current = { data: [], error: null }
    render(<RecentWorkoutsCard />, { wrapper })
    await waitFor(() =>
      expect(screen.getByText(/no workouts yet/i)).toBeInTheDocument()
    )
  })
})
