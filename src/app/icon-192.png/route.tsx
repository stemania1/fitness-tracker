import { iconImageResponse } from "@/lib/icon-image"

/** Stable PNG icon URL (manifest + service-worker notifications). */
export const runtime = "edge"

export function GET() {
  return iconImageResponse(192)
}
