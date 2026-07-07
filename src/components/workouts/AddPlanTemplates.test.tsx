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
import { TRAINING_PLAN_PRESETS } from "@/data/template-presets"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  templatesIn: vi.fn(),
  templateInsert: vi.fn(),
  templateInsertSingle: vi.fn(),
  exercisesInsert: vi.fn(),
  ensureExercisesExist: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) =>
      table === "workout_templates"
        ? {
            select: () => ({
              eq: () => ({ in: mocks.templatesIn }),
            }),
            insert: (row: Record<string, unknown>) => {
              mocks.templateInsert(row)
              return {
                select: () => ({ single: mocks.templateInsertSingle }),
              }
            },
          }
        : { insert: mocks.exercisesInsert },
  }),
}))

vi.mock("@/lib/supabase/exercises", () => ({
  ensureExercisesExist: mocks.ensureExercisesExist,
}))

import { AddPlanTemplates } from "./AddPlanTemplates"

const allCatalogIds = TRAINING_PLAN_PRESETS.flatMap((p) =>
  p.exercises.map((e) => e.exerciseId)
)

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.templatesIn.mockReset().mockResolvedValue({ data: [], error: null })
  mocks.templateInsert.mockReset()
  mocks.templateInsertSingle
    .mockReset()
    .mockResolvedValue({ data: { id: "tpl-1" }, error: null })
  mocks.exercisesInsert.mockReset().mockResolvedValue({ error: null })
  mocks.ensureExercisesExist
    .mockReset()
    .mockResolvedValue(new Map(allCatalogIds.map((id) => [id, `db-${id}`])))
})

afterEach(() => {
  cleanup()
})

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

describe("AddPlanTemplates", () => {
  it("offers to add both templates when neither exists", async () => {
    renderWithClient(<AddPlanTemplates />)
    expect(
      await screen.findByRole("button", { name: /add pull a \+ pull b/i })
    ).toBeInTheDocument()
  })

  it("creates both templates with their exercises on click", async () => {
    renderWithClient(<AddPlanTemplates />)
    fireEvent.click(
      await screen.findByRole("button", { name: /add pull a \+ pull b/i })
    )

    await waitFor(() => {
      expect(mocks.templateInsert).toHaveBeenCalledTimes(2)
    })

    const names = mocks.templateInsert.mock.calls.map((c) => c[0].name)
    expect(names).toEqual(["Pull A", "Pull B"])
    expect(mocks.templateInsert.mock.calls[0][0].split_type).toBe("pull")
    expect(mocks.templateInsert.mock.calls[0][0].user_id).toBe("u1")

    // Each template's exercises land in one insert, in prescription order.
    expect(mocks.exercisesInsert).toHaveBeenCalledTimes(2)
    const pullARows = mocks.exercisesInsert.mock.calls[0][0]
    expect(pullARows).toHaveLength(TRAINING_PLAN_PRESETS[0].exercises.length)
    expect(pullARows[0].exercise_id).toBe("db-assisted-pull-up")
    expect(pullARows[0].order_index).toBe(0)
    expect(pullARows[0].reps).toBe("6-8")
  })

  it("only offers the missing template when one already exists", async () => {
    mocks.templatesIn.mockResolvedValue({
      data: [{ name: "Pull A" }],
      error: null,
    })
    renderWithClient(<AddPlanTemplates />)
    const button = await screen.findByRole("button", {
      name: /add pull b template/i,
    })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mocks.templateInsert).toHaveBeenCalledTimes(1)
    })
    expect(mocks.templateInsert.mock.calls[0][0].name).toBe("Pull B")
  })

  it("shows the added state when both templates exist", async () => {
    mocks.templatesIn.mockResolvedValue({
      data: [{ name: "Pull A" }, { name: "Pull B" }],
      error: null,
    })
    renderWithClient(<AddPlanTemplates />)
    expect(
      await screen.findByText(/pull a & pull b templates added/i)
    ).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("surfaces insert errors", async () => {
    mocks.templateInsertSingle.mockResolvedValue({
      data: null,
      error: { message: "row violates RLS" },
    })
    renderWithClient(<AddPlanTemplates />)
    fireEvent.click(
      await screen.findByRole("button", { name: /add pull a \+ pull b/i })
    )
    expect(await screen.findByText(/row violates RLS/i)).toBeInTheDocument()
  })
})
