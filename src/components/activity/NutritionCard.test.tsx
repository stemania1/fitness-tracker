// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  rows: [] as unknown[],
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_t: string) => ({
      // select().eq().gte().order() → today's rows
      select: () => ({
        eq: () => ({
          gte: () => ({
            order: () => Promise.resolve({ data: mocks.rows, error: null }),
          }),
        }),
      }),
      insert: mocks.insert,
    }),
  }),
}))

import { NutritionCard } from "./NutritionCard"

const FISH = {
  id: "meal-1",
  description: "Fried fish",
  meal_type: "dinner",
  calories: 320,
  protein_g: 22,
  carbs_g: 14,
  fat_g: 18,
  confidence: "medium" as const,
  image_path: "u1/fish.jpg",
  logged_at: "2026-07-11T23:00:00.000Z",
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.insert.mockReset().mockResolvedValue({ error: null })
  mocks.rows = [FISH]
})

afterEach(() => cleanup())

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe("NutritionCard — log another serving", () => {
  it("re-inserts an identical food log with a fresh timestamp", async () => {
    renderWithClient(<NutritionCard />)
    // Wait for the meal to render.
    expect(await screen.findByText("Fried fish")).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: /log another serving of fried fish/i })
    )

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.user_id).toBe("u1")
    expect(row.description).toBe("Fried fish")
    expect(row.meal_type).toBe("dinner")
    expect(row.calories).toBe(320)
    expect(row.protein_g).toBe(22)
    expect(row.image_path).toBe("u1/fish.jpg")
    expect(row.edited).toBe(false)
    // Not carrying over the original id or timestamp — it's a new row.
    expect(row.id).toBeUndefined()
    expect(row.logged_at).toBeUndefined()
  })
})
