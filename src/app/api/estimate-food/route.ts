import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  FOOD_ESTIMATE_SCHEMA,
  FOOD_ESTIMATE_SYSTEM_PROMPT,
  sanitizeEstimate,
} from "@/lib/food-estimate"

// Vision analysis routinely takes longer than the platform's default function
// timeout (~10s). Without this, a slow estimate gets killed mid-flight and the
// browser surfaces it as a cryptic "Load failed" instead of a real response.
export const maxDuration = 60

const ALLOWED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

/** ~5 MB of base64 (≈3.75 MB binary) — client should downscale before send. */
const MAX_BASE64_LENGTH = 5_000_000

/** A user-corrected description is a sentence, not an essay. */
const MAX_CORRECTION_LENGTH = 500

/**
 * POST /api/estimate-food — estimate calories + macros from a meal photo.
 * Body: { imageBase64: string, mediaType: string, correction?: string }.
 * `correction` is the user's edited description of the meal; when present
 * the model re-estimates for what the user says it is, using the photo
 * only for portion size. Does not persist anything; the client saves the
 * confirmed estimate separately.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Food estimation is not configured on the server." },
      { status: 503 }
    )
  }

  let body: { imageBase64?: unknown; mediaType?: unknown; correction?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { imageBase64, mediaType, correction } = body
  if (typeof imageBase64 !== "string" || typeof mediaType !== "string") {
    return NextResponse.json(
      { error: "imageBase64 and mediaType are required" },
      { status: 400 }
    )
  }
  if (
    correction !== undefined &&
    (typeof correction !== "string" ||
      correction.trim().length === 0 ||
      correction.length > MAX_CORRECTION_LENGTH)
  ) {
    return NextResponse.json(
      { error: "correction must be a short non-empty string" },
      { status: 400 }
    )
  }
  if (!ALLOWED_MEDIA.has(mediaType)) {
    return NextResponse.json(
      { error: "Unsupported image type" },
      { status: 400 }
    )
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json(
      { error: "Image too large — please use a smaller photo" },
      { status: 413 }
    )
  }

  const client = new Anthropic()

  // Structured output via a forced tool call — portable across SDK versions
  // and models. The tool's input schema is the estimate shape.
  let response
  try {
    response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: FOOD_ESTIMATE_SYSTEM_PROMPT,
      tools: [
        {
          name: "record_estimate",
          description: "Record the estimated calories and macros for the meal.",
          // Cast: the schema is `as const` (readonly) in the lib; the SDK's
          // InputSchema type is mutable. Runtime shape is identical.
          input_schema:
            FOOD_ESTIMATE_SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "record_estimate" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/webp"
                  | "image/gif",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text:
                typeof correction === "string"
                  ? `The user corrected the meal description to: "${correction.trim()}". ` +
                    "Trust their description of what the food is over your own reading of the photo, " +
                    "and use the photo only to judge portion size. Re-estimate the calories and " +
                    "macronutrients for the corrected meal, and base the returned description on theirs."
                  : "Estimate the calories and macronutrients for this meal.",
            },
          ],
        },
      ],
    })
  } catch (err) {
    console.error("[estimate-food] Anthropic call failed", err)
    return NextResponse.json(
      { error: "Could not analyze the photo right now. Try again." },
      { status: 502 }
    )
  }

  const toolUse = response.content.find((b) => b.type === "tool_use")
  if (!toolUse || !("input" in toolUse)) {
    return NextResponse.json(
      { error: "The estimate came back malformed. Try again." },
      { status: 502 }
    )
  }

  return NextResponse.json({ estimate: sanitizeEstimate(toolUse.input) })
}
