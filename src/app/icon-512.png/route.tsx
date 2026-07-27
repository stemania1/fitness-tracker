import { iconImageResponse } from "@/lib/icon-image"

/** Stable PNG icon URL for the manifest / install prompt. */
export const runtime = "edge"

export function GET() {
  return iconImageResponse(512)
}
