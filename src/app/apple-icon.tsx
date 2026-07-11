import { ImageResponse } from "next/og"

/**
 * iOS home-screen icon. iOS ignores SVG for apple-touch-icon, so render a
 * real PNG at build time from JSX via ImageResponse (no external image
 * tooling or design asset needed). Matches the purple dumbbell in icon.svg.
 */
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
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
        {/* dumbbell: plate · bar · plate */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 30,
              height: 78,
              background: "#ffffff",
              borderRadius: 10,
            }}
          />
          <div
            style={{
              width: 12,
              height: 100,
              background: "#ffffff",
              borderRadius: 6,
              marginLeft: 4,
            }}
          />
          <div
            style={{
              width: 54,
              height: 22,
              background: "#ffffff",
            }}
          />
          <div
            style={{
              width: 12,
              height: 100,
              background: "#ffffff",
              borderRadius: 6,
              marginRight: 4,
            }}
          />
          <div
            style={{
              width: 30,
              height: 78,
              background: "#ffffff",
              borderRadius: 10,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  )
}
