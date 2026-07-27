import { ImageResponse } from "next/og"

/**
 * The app mark (purple tile + white dumbbell) rendered as a real PNG at any
 * size, via ImageResponse — no external image tooling or binary asset needed.
 *
 * PNGs matter beyond aesthetics: iOS ignores SVG for apple-touch-icon, and
 * Safari won't render a *notification* whose icon is an SVG, so web-push
 * notifications silently fail to appear. Shared by the apple-icon and the
 * /icon-<size>.png routes referenced by the manifest and service worker.
 */
export function iconImageResponse(size: number): ImageResponse {
  // Proportions of the 512-viewBox source in icon.svg, as fractions of size.
  const plateW = size * 0.086
  const plateH = size * 0.234
  const innerW = size * 0.086
  const innerH = size * 0.42
  const barW = size * 0.3
  const barH = size * 0.066
  const gap = size * 0.02

  const white = "#ffffff"
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#9333ea",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: plateW,
              height: plateH,
              background: white,
              borderRadius: size * 0.023,
            }}
          />
          <div
            style={{
              width: innerW,
              height: innerH,
              background: white,
              borderRadius: size * 0.027,
              marginLeft: gap,
            }}
          />
          <div style={{ width: barW, height: barH, background: white }} />
          <div
            style={{
              width: innerW,
              height: innerH,
              background: white,
              borderRadius: size * 0.027,
              marginRight: gap,
            }}
          />
          <div
            style={{
              width: plateW,
              height: plateH,
              background: white,
              borderRadius: size * 0.023,
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
