import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  create: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getUser: mocks.getUser },
  }),
}))

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.create }
  },
}))

import { POST } from "./route"

const OLD_ENV = process.env.ANTHROPIC_API_KEY

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.create.mockReset()
  process.env.ANTHROPIC_API_KEY = "sk-test"
})

function req(body: unknown): Request {
  return new Request("http://localhost/api/estimate-food", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const goodBody = { imageBase64: "AAAA", mediaType: "image/jpeg" }

describe("POST /api/estimate-food", () => {
  it("401 without a user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(req(goodBody))
    expect(res.status).toBe(401)
  })

  it("503 when the API key is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await POST(req(goodBody))
    expect(res.status).toBe(503)
    process.env.ANTHROPIC_API_KEY = OLD_ENV ?? "sk-test"
  })

  it("400 for half an image (one of base64/media type missing)", async () => {
    expect((await POST(req({ mediaType: "image/jpeg" }))).status).toBe(400)
    expect((await POST(req({ imageBase64: "AAAA" }))).status).toBe(400)
  })

  it("400 when neither a photo nor a description is provided", async () => {
    expect((await POST(req({}))).status).toBe(400)
  })

  it("estimates from a text description alone (no image block sent)", async () => {
    mocks.create.mockResolvedValue({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          input: {
            description: "Fried chicken thigh",
            items: [{ name: "Fried chicken thigh", calories: 280 }],
            calories: 280,
            protein_g: 19,
            carbs_g: 8,
            fat_g: 18,
            confidence: "medium",
          },
        },
      ],
    })

    const res = await POST(req({ correction: "fried chicken thigh" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.estimate.calories).toBe(280)

    const args = mocks.create.mock.calls[0][0]
    const types = args.messages[0].content.map((b: { type: string }) => b.type)
    expect(types).toEqual(["text"]) // no image block
    expect(args.messages[0].content[0].text).toContain('"fried chicken thigh"')
    expect(args.messages[0].content[0].text).toMatch(/typical serving/i)
  })

  it("400 for an unsupported media type", async () => {
    const res = await POST(req({ imageBase64: "AAAA", mediaType: "image/tiff" }))
    expect(res.status).toBe(400)
  })

  it("413 for an oversized image", async () => {
    const res = await POST(
      req({ imageBase64: "A".repeat(5_000_001), mediaType: "image/jpeg" })
    )
    expect(res.status).toBe(413)
  })

  it("returns a sanitized estimate from the tool call", async () => {
    mocks.create.mockResolvedValue({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          name: "record_estimate",
          input: {
            description: "Chicken bowl",
            items: [{ name: "Chicken", calories: 300 }],
            calories: 550,
            protein_g: 40,
            carbs_g: 45,
            fat_g: 18,
            confidence: "medium",
          },
        },
      ],
    })

    const res = await POST(req(goodBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.estimate.calories).toBe(550)
    expect(body.estimate.description).toBe("Chicken bowl")

    // Sent an image block and forced the tool.
    const args = mocks.create.mock.calls[0][0]
    expect(args.tool_choice).toEqual({ type: "tool", name: "record_estimate" })
    expect(args.messages[0].content[0].type).toBe("image")
    expect(args.model).toBe("claude-sonnet-5")
  })

  it("passes a user correction through to the model prompt", async () => {
    mocks.create.mockResolvedValue({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          input: {
            description: "Egg sandwich, no mayo",
            items: [],
            calories: 400,
            protein_g: 15,
            carbs_g: 40,
            fat_g: 20,
            confidence: "medium",
          },
        },
      ],
    })

    const res = await POST(
      req({ ...goodBody, correction: "Egg sandwich, no mayo" })
    )
    expect(res.status).toBe(200)
    const args = mocks.create.mock.calls[0][0]
    const textBlock = args.messages[0].content.find(
      (b: { type: string }) => b.type === "text"
    )
    expect(textBlock.text).toContain('"Egg sandwich, no mayo"')
    expect(textBlock.text).toMatch(/trust their description/i)
  })

  it("400 for a blank or oversized correction", async () => {
    expect((await POST(req({ ...goodBody, correction: "  " }))).status).toBe(400)
    expect(
      (await POST(req({ ...goodBody, correction: "x".repeat(501) }))).status
    ).toBe(400)
    expect((await POST(req({ ...goodBody, correction: 42 }))).status).toBe(400)
  })

  it("sanitizes junk numbers from the model", async () => {
    mocks.create.mockResolvedValue({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          input: {
            description: "Mystery",
            items: [],
            calories: -50,
            protein_g: "x",
            carbs_g: 10,
            fat_g: 5,
            confidence: "nonsense",
          },
        },
      ],
    })
    const res = await POST(req(goodBody))
    const body = await res.json()
    expect(body.estimate.calories).toBe(0)
    expect(body.estimate.protein_g).toBe(0)
    expect(body.estimate.confidence).toBe("low")
  })

  it("502 when no tool_use block comes back", async () => {
    mocks.create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "I can't tell" }],
    })
    const res = await POST(req(goodBody))
    expect(res.status).toBe(502)
  })

  it("502 when the Anthropic call throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.create.mockRejectedValue(new Error("network"))
    const res = await POST(req(goodBody))
    expect(res.status).toBe(502)
  })
})
