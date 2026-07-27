import { iconImageResponse } from "@/lib/icon-image"

/**
 * iOS home-screen icon. iOS ignores SVG for apple-touch-icon, so render a
 * real PNG at build time (see lib/icon-image).
 */
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return iconImageResponse(size.width)
}
