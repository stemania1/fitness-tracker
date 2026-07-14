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
  sugar_g: 9,
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
    expect(row.sugar_g).toBe(9)
    expect(row.edited).toBe(false)
    expect(row.image_path).toMatch(/^u1\//)
    expect(mocks.upload).toHaveBeenCalledTimes(1)
  })

  it("estimates a manually described meal without a photo and saves it", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        estimate: {
          ...ESTIMATE,
          description: "Fried chicken thigh",
          calories: 280,
        },
      }),
    }) as unknown as typeof fetch

    renderWithClient(<QuickLogFood />)
    fireEvent.click(screen.getByRole("button", { name: /snap meal/i }))
    await screen.findByRole("dialog")

    fireEvent.change(screen.getByLabelText("Meal description"), {
      target: { value: "fried chicken thigh" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^estimate$/i }))
    await screen.findByDisplayValue("Fried chicken thigh")

    // Text-only request: correction present, no image fields.
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const sent = JSON.parse(call[1].body)
    expect(sent.correction).toBe("fried chicken thigh")
    expect(sent.imageBase64).toBeUndefined()

    // Saving works with no photo — no upload, null image_path.
    fireEvent.click(screen.getByRole("button", { name: /save meal/i }))
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.calories).toBe(280)
    expect(row.image_path).toBeNull()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it("re-estimates the numbers from an edited description", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ estimate: ESTIMATE }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          estimate: {
            ...ESTIMATE,
            description: "Chicken bowl, no rice",
            calories: 380,
            carbs_g: 10,
          },
        }),
      }) as unknown as typeof fetch

    renderWithClient(<QuickLogFood />)
    await openAndEstimate()

    // No re-estimate button until the description actually changes.
    expect(screen.queryByRole("button", { name: /update numbers/i })).toBeNull()

    fireEvent.change(screen.getByLabelText("Meal"), {
      target: { value: "Chicken bowl, no rice" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: /update numbers from description/i })
    )

    // Second API call carries the correction alongside the same photo.
    await screen.findByDisplayValue("380")
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(call[0]).toBe("/api/estimate-food")
    expect(JSON.parse(call[1].body).correction).toBe("Chicken bowl, no rice")
    // New estimate becomes the baseline, so the button disappears again.
    expect(screen.queryByRole("button", { name: /update numbers/i })).toBeNull()
  })

  it("clears a numeric field to empty instead of a sticky zero", async () => {
    renderWithClient(<QuickLogFood />)
    await openAndEstimate()

    const cal = screen.getByLabelText("Calories")
    // Clearing the field leaves it visibly empty (state holds 0)...
    fireEvent.change(cal, { target: { value: "" } })
    expect(cal).toHaveValue(null)
    // ...so typing a new number replaces it rather than appending ("0460").
    fireEvent.change(cal, { target: { value: "460" } })
    expect(cal).toHaveValue(460)

    fireEvent.click(screen.getByRole("button", { name: /save meal/i }))
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    expect(mocks.insert.mock.calls[0][0].calories).toBe(460)
  })

  it("renders the description as a wrapping textarea and flattens newlines", async () => {
    renderWithClient(<QuickLogFood />)
    await openAndEstimate()

    const desc = screen.getByLabelText("Meal")
    // A single-line input clips long descriptions; the review step needs the
    // whole text visible.
    expect(desc.tagName).toBe("TEXTAREA")

    fireEvent.change(desc, {
      target: { value: "Chicken bowl\nwith extra rice" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save meal/i }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.description).toBe("Chicken bowl with extra rice")
    expect(row.edited).toBe(true)
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

  it("shows a connection message and retries the same photo after a network drop", async () => {
    // First attempt: fetch rejects like a dropped connection ("Load failed").
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ estimate: ESTIMATE }),
      }) as unknown as typeof fetch

    renderWithClient(<QuickLogFood />)
    fireEvent.click(screen.getByRole("button", { name: /snap meal/i }))
    await screen.findByRole("dialog")
    selectPhoto()

    // Friendly, actionable message rather than the raw "Load failed".
    expect(
      await screen.findByText(/couldn.t reach the server/i)
    ).toBeInTheDocument()

    // Retrying reuses the already-processed image (no second file processing).
    fireEvent.click(
      screen.getByRole("button", { name: /try again with the same photo/i })
    )
    await screen.findByDisplayValue("Chicken bowl")
    expect(mocks.fileToProcessedImage).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch as ReturnType<typeof vi.fn>).toHaveProperty(
      "mock"
    )
    expect(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBe(2)
  })
})
