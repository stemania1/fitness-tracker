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
  upload: vi.fn(),
  fileToProcessedImage: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_t: string) => ({ insert: mocks.insert }),
    storage: { from: (_b: string) => ({ upload: mocks.upload }) },
  }),
}))

vi.mock("@/lib/image-resize", () => ({
  fileToProcessedImage: mocks.fileToProcessedImage,
}))

import { QuickLogFood } from "./QuickLogFood"

const realFetch = globalThis.fetch

const ESTIMATE = {
  description: "Chicken bowl",
  portion: "about 1 bowl (400g)",
  items: [{ name: "Chicken", calories: 300 }],
  calories: 550,
  protein_g: 40,
  carbs_g: 45,
  fat_g: 18,
  confidence: "medium" as const,
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.insert.mockReset().mockResolvedValue({ error: null })
  mocks.upload.mockReset().mockResolvedValue({ error: null })
  mocks.fileToProcessedImage
    .mockReset()
    .mockResolvedValue({ base64: "AAAA", blob: new Blob(["x"]), mediaType: "image/jpeg" })
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ estimate: ESTIMATE }),
  }) as unknown as typeof fetch
  // crypto.randomUUID for the storage path
  if (!("randomUUID" in globalThis.crypto)) {
    // @ts-expect-error test shim
    globalThis.crypto.randomUUID = () => "test-uuid"
  }
})

afterEach(() => {
  cleanup()
  globalThis.fetch = realFetch
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

function selectPhoto() {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement
  const file = new File(["x"], "meal.jpg", { type: "image/jpeg" })
  fireEvent.change(input, { target: { files: [file] } })
}

async function openAndEstimate() {
  fireEvent.click(screen.getByRole("button", { name: /snap meal/i }))
  await screen.findByRole("dialog")
  selectPhoto()
  // Review phase shows the description input prefilled.
  await screen.findByDisplayValue("Chicken bowl")
}

describe("QuickLogFood", () => {
  it("renders the trigger button and no dialog by default", () => {
    renderWithClient(<QuickLogFood />)
    expect(screen.getByRole("button", { name: /snap meal/i })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("estimates from a photo and shows the editable review", async () => {
    renderWithClient(<QuickLogFood />)
    await openAndEstimate()
    expect(screen.getByDisplayValue("550")).toBeInTheDocument() // calories
    expect(screen.getByDisplayValue("40")).toBeInTheDocument() // protein
    // Shows the assumed portion.
    expect(screen.getByText(/about 1 bowl \(400g\)/i)).toBeInTheDocument()
    // Posted the processed image to the estimate endpoint.
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe("/api/estimate-food")
    expect(JSON.parse(call[1].body).mediaType).toBe("image/jpeg")
  })

  it("scales calories and macros when a portion multiplier is tapped", async () => {
    renderWithClient(<QuickLogFood />)
    await openAndEstimate()

    fireEvent.click(screen.getByRole("button", { name: "2×" }))
    // 550→1100, 40→80, 45→90, 18→36
    expect(screen.getByDisplayValue("1100")).toBeInTheDocument()
    expect(screen.getByDisplayValue("80")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /save meal/i }))
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.calories).toBe(1100)
    expect(row.protein_g).toBe(80)
    // Scaling the portion counts as an edit.
    expect(row.edited).toBe(true)
  })

  it("saves an unedited estimate with edited=false and uploads the photo", async () => {
    renderWithClient(<QuickLogFood />)
    await openAndEstimate()
    fireEvent.click(screen.getByRole("button", { name: /save meal/i }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.calories).toBe(550)
    expect(row.edited).toBe(false)
    expect(row.image_path).toMatch(/^u1\//)
    expect(mocks.upload).toHaveBeenCalledTimes(1)
  })

  it("marks the log edited=true when the user changes a value", async () => {
    renderWithClient(<QuickLogFood />)
    await openAndEstimate()
    fireEvent.change(screen.getByDisplayValue("550"), {
      target: { value: "700" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save meal/i }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.calories).toBe(700)
    expect(row.edited).toBe(true)
  })

  it("still logs the meal when the photo upload fails", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "storage down" } })
    renderWithClient(<QuickLogFood />)
    await openAndEstimate()
    fireEvent.click(screen.getByRole("button", { name: /save meal/i }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    expect(mocks.insert.mock.calls[0][0].image_path).toBeNull()
  })

  it("surfaces an estimation error and stays on the capture step", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Could not analyze the photo." }),
    }) as unknown as typeof fetch

    renderWithClient(<QuickLogFood />)
    fireEvent.click(screen.getByRole("button", { name: /snap meal/i }))
    await screen.findByRole("dialog")
    selectPhoto()

    expect(
      await screen.findByText(/could not analyze the photo/i)
    ).toBeInTheDocument()
    expect(mocks.insert).not.toHaveBeenCalled()
  })
})
