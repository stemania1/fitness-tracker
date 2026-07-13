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
  deleteEq: vi.fn(),
  removePhoto: vi.fn(),
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
      delete: () => ({ eq: mocks.deleteEq }),
    }),
    storage: { from: (_b: string) => ({ remove: mocks.removePhoto }) },
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
  sugar_g: 5,
  confidence: "medium" as const,
  image_path: "u1/fish.jpg",
  logged_at: "2026-07-11T23:00:00.000Z",
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.insert.mockReset().mockResolvedValue({ error: null })
  mocks.deleteEq.mockReset().mockResolvedValue({ error: null })
  mocks.removePhoto.mockReset().mockResolvedValue({ error: null })
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

const TARGETS = {
  calories: 2360,
  protein_g: 175,
  carbs_g: 240,
  fat_g: 80,
  sugar_limit_g: 60,
  goalNote: "a 500 cal/day deficit (~1 lb/week) for your weight-loss goal",
}

describe("NutritionCard — targets", () => {
  it("shows consumption vs recommended targets with progress bars", async () => {
    renderWithClient(<NutritionCard targets={TARGETS} />)
    expect(await screen.findByText("Fried fish")).toBeInTheDocument()

    // Calories headline includes the daily target.
    expect(screen.getByText(/of 2,360/)).toBeInTheDocument()
    // Each macro tile shows "consumed / target".
    expect(screen.getByText("/ 175g")).toBeInTheDocument()
    expect(screen.getByText("/ 240g")).toBeInTheDocument()
    expect(screen.getByText("/ 80g")).toBeInTheDocument()

    // Progress bars reflect consumed vs target (22g of 175g protein).
    const proteinBar = screen.getByRole("progressbar", {
      name: /protein vs daily target/i,
    })
    expect(proteinBar).toHaveAttribute("aria-valuenow", "22")
    expect(proteinBar).toHaveAttribute("aria-valuemax", "175")

    // Sugar shows as a ceiling with its own progress bar (5g of 60g).
    expect(screen.getByText(/aim under 60g/)).toBeInTheDocument()
    const sugarBar = screen.getByRole("progressbar", {
      name: /sugar vs daily limit/i,
    })
    expect(sugarBar).toHaveAttribute("aria-valuenow", "5")
    expect(sugarBar).toHaveAttribute("aria-valuemax", "60")

    // Footer explains where the numbers come from.
    expect(
      screen.getByText(/targets estimated from your height, weight, age/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/weight-loss goal/i)).toBeInTheDocument()
  })

  it("lists the day's targets in the empty state", async () => {
    mocks.rows = []
    renderWithClient(<NutritionCard targets={TARGETS} />)
    expect(await screen.findByText(/no meals logged today/i)).toBeInTheDocument()
    expect(
      screen.getByText(/2,360 cal · 175g protein · 240g carbs · 80g fat/)
    ).toBeInTheDocument()
  })

  it("renders without target markup when no targets are available", async () => {
    renderWithClient(<NutritionCard />)
    expect(await screen.findByText("Fried fish")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.queryByText(/of 2,360/)).toBeNull()
    expect(screen.queryByText(/targets estimated/i)).toBeNull()
  })
})

describe("NutritionCard — delete entry", () => {
  it("requires a second tap to confirm, then deletes the row and its photo", async () => {
    renderWithClient(<NutritionCard />)
    expect(await screen.findByText("Fried fish")).toBeInTheDocument()

    // First tap only arms the button — nothing deleted yet.
    fireEvent.click(screen.getByRole("button", { name: /^delete fried fish/i }))
    expect(mocks.deleteEq).not.toHaveBeenCalled()

    // Second tap (now labelled as confirm) performs the delete.
    fireEvent.click(
      screen.getByRole("button", { name: /confirm delete of fried fish/i })
    )
    await waitFor(() => expect(mocks.deleteEq).toHaveBeenCalledTimes(1))
    expect(mocks.deleteEq).toHaveBeenCalledWith("id", "meal-1")
    // Stored photo is cleaned up best-effort.
    await waitFor(() =>
      expect(mocks.removePhoto).toHaveBeenCalledWith(["u1/fish.jpg"])
    )
  })

  it("skips photo cleanup for entries without an image", async () => {
    mocks.rows = [{ ...FISH, image_path: null }]
    renderWithClient(<NutritionCard />)
    expect(await screen.findByText("Fried fish")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /^delete fried fish/i }))
    fireEvent.click(
      screen.getByRole("button", { name: /confirm delete of fried fish/i })
    )
    await waitFor(() => expect(mocks.deleteEq).toHaveBeenCalledTimes(1))
    expect(mocks.removePhoto).not.toHaveBeenCalled()
  })
})

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
