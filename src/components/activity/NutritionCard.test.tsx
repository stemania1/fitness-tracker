// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  deleteEq: vi.fn(),
  updateEq: vi.fn(),
  updateValues: vi.fn(),
  removePhoto: vi.fn(),
  rows: [] as unknown[],
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_t: string) => ({
      // select().eq().gte().lt().order() → the day's rows
      select: () => ({
        eq: () => ({
          gte: () => ({
            lt: () => ({
              order: () => Promise.resolve({ data: mocks.rows, error: null }),
            }),
          }),
        }),
      }),
      insert: mocks.insert,
      update: (values: Record<string, unknown>) => {
        mocks.updateValues(values)
        return { eq: mocks.updateEq }
      },
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
  glycemic_load: 8,
  confidence: "medium" as const,
  image_path: "u1/fish.jpg",
  logged_at: "2026-07-11T23:00:00.000Z",
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.insert.mockReset().mockResolvedValue({ error: null })
  mocks.deleteEq.mockReset().mockResolvedValue({ error: null })
  mocks.removePhoto.mockReset().mockResolvedValue({ error: null })
  mocks.updateEq.mockReset().mockResolvedValue({ error: null })
  mocks.updateValues.mockReset()
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

const DONUT = {
  id: "meal-2",
  description: "Chocolate donut",
  meal_type: "meal",
  calories: 520,
  protein_g: 6,
  carbs_g: 62,
  fat_g: 28,
  sugar_g: 28,
  glycemic_load: 32, // high per-meal (>=20), but low for a whole day
  confidence: "low" as const,
  image_path: null,
  logged_at: "2026-07-11T14:00:00.000Z",
}

describe("NutritionCard — glucose impact surfacing", () => {
  it("shows a High GL chip on a high-impact meal without expanding it", async () => {
    mocks.rows = [DONUT]
    renderWithClient(<NutritionCard />)
    expect(await screen.findByText("Chocolate donut")).toBeInTheDocument()
    expect(screen.getByText("High GL")).toBeInTheDocument()
  })

  it("calls out a high-impact meal even when the daily total is low", async () => {
    mocks.rows = [DONUT]
    renderWithClient(<NutritionCard />)
    await screen.findByText("Chocolate donut")
    // Daily total (GL 32) is 'low', but the high meal is surfaced on its own.
    expect(screen.getByText(/1 high-impact meal/i)).toBeInTheDocument()
    expect(screen.getByText(/doesn't undo a big spike/i)).toBeInTheDocument()
  })

  it("does not flag or chip a low-impact day", async () => {
    mocks.rows = [FISH] // GL 8
    renderWithClient(<NutritionCard />)
    await screen.findByText("Fried fish")
    expect(screen.queryByText("High GL")).toBeNull()
    expect(screen.queryByText(/high-impact meal/i)).toBeNull()
  })
})

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

describe("NutritionCard — meal stats", () => {
  it("expands a tapped meal to show calories, macros, and sugar", async () => {
    renderWithClient(<NutritionCard />)
    expect(await screen.findByText("Fried fish")).toBeInTheDocument()

    const toggle = screen.getByRole("button", {
      name: /show stats for fried fish/i,
    })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    // Scope to the row — with a single meal the day's totals elsewhere in
    // the card show the same numbers.
    const row = within(toggle.closest("li") as HTMLElement)
    expect(row.queryByText(/logged at/i)).toBeNull()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(row.getByText("22g")).toBeInTheDocument() // protein
    expect(row.getByText("14g")).toBeInTheDocument() // carbs
    expect(row.getByText("18g")).toBeInTheDocument() // fat
    expect(row.getByText("5g")).toBeInTheDocument() // sugar
    expect(row.getByText("Cal")).toBeInTheDocument() // calories tile label
    // GL 8 classifies as low glucose impact.
    expect(row.getByText("Glucose impact")).toBeInTheDocument()
    expect(row.getByText("low")).toBeInTheDocument()
    expect(row.getByText(/logged at/i)).toBeInTheDocument()

    // Tapping again collapses it.
    fireEvent.click(toggle)
    expect(row.queryByText(/logged at/i)).toBeNull()
  })

  it("keeps multiple meals expanded at the same time", async () => {
    mocks.rows = [
      FISH,
      { ...FISH, id: "meal-2", description: "Greek yogurt", sugar_g: 12 },
    ]
    renderWithClient(<NutritionCard />)
    expect(await screen.findByText("Greek yogurt")).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: /show stats for fried fish/i })
    )
    fireEvent.click(
      screen.getByRole("button", { name: /show stats for greek yogurt/i })
    )

    // Both panels are open at once — expanding one doesn't collapse the other.
    expect(screen.getAllByText(/logged at/i)).toHaveLength(2)
    expect(
      screen.getByRole("button", { name: /show stats for fried fish/i })
    ).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByRole("button", { name: /show stats for greek yogurt/i })
    ).toHaveAttribute("aria-expanded", "true")
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

describe("NutritionCard — portion rescale", () => {
  it("halves every nutrient and relabels the description", async () => {
    renderWithClient(<NutritionCard />)
    expect(await screen.findByText("Fried fish")).toBeInTheDocument()
    // Expand the meal, then open the portion chips.
    fireEvent.click(
      screen.getByRole("button", { name: /show stats for fried fish/i })
    )
    fireEvent.click(
      screen.getByRole("button", { name: /adjust portion for fried fish/i })
    )
    fireEvent.click(
      screen.getByRole("button", { name: /rescale fried fish to ½/i })
    )

    await waitFor(() => expect(mocks.updateValues).toHaveBeenCalled())
    const values = mocks.updateValues.mock.calls[0][0]
    expect(values.calories).toBe(160)
    expect(values.protein_g).toBe(11)
    expect(values.carbs_g).toBe(7)
    expect(values.fat_g).toBe(9)
    expect(values.sugar_g).toBe(2.5)
    // Glycemic load scales with the carbs eaten.
    expect(values.glycemic_load).toBe(4)
    expect(values.description).toBe("½ of Fried fish")
    expect(values.edited).toBe(true)
  })

  it("scales up for a larger portion", async () => {
    renderWithClient(<NutritionCard />)
    expect(await screen.findByText("Fried fish")).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: /show stats for fried fish/i })
    )
    fireEvent.click(
      screen.getByRole("button", { name: /adjust portion for fried fish/i })
    )
    fireEvent.click(
      screen.getByRole("button", { name: /rescale fried fish to 2×/i })
    )

    await waitFor(() => expect(mocks.updateValues).toHaveBeenCalled())
    expect(mocks.updateValues.mock.calls[0][0].calories).toBe(640)
  })

  it("leaves the meal alone until a portion is chosen", async () => {
    renderWithClient(<NutritionCard />)
    expect(await screen.findByText("Fried fish")).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: /show stats for fried fish/i })
    )
    fireEvent.click(
      screen.getByRole("button", { name: /adjust portion for fried fish/i })
    )
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }))
    expect(mocks.updateValues).not.toHaveBeenCalled()
  })
})
