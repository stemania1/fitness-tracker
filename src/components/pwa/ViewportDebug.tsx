"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Query-param-gated viewport readout, for diagnosing layout bugs that only
 * reproduce in the installed iOS PWA.
 *
 * The bottom nav has now been "fixed" three times from screenshots alone,
 * because none of the values that actually drive the layout — what iOS
 * resolves `100dvh` to, what the visual viewport reports, whether the safe
 * area insets are non-zero — are visible from the outside. This renders them
 * on screen so a single screenshot answers the question.
 *
 * Off unless the URL carries `?debug=viewport`, so it costs nothing in normal
 * use. The height probes are the important part: they measure what the device
 * ACTUALLY resolves each unit to, rather than what the spec says it should.
 */

type Rows = Array<[string, string]>

/** Measure a unit by laying out an off-screen probe and reading it back. */
function probeHeight(css: string): number {
  const el = document.createElement("div")
  el.style.cssText = `position:absolute;top:-9999px;left:0;width:1px;height:${css};`
  document.body.appendChild(el)
  const h = el.getBoundingClientRect().height
  el.remove()
  return Math.round(h)
}

/** Read the four safe-area insets via a probe using env(). */
function probeInsets(): string {
  const el = document.createElement("div")
  el.style.cssText =
    "position:absolute;top:-9999px;left:0;" +
    "padding-top:env(safe-area-inset-top);" +
    "padding-right:env(safe-area-inset-right);" +
    "padding-bottom:env(safe-area-inset-bottom);" +
    "padding-left:env(safe-area-inset-left);"
  document.body.appendChild(el)
  const s = getComputedStyle(el)
  const out = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft]
    .map((v) => Math.round(parseFloat(v) || 0))
    .join(" / ")
  el.remove()
  return out
}

function rect(selector: string): string {
  const el = document.querySelector(selector)
  if (!el) return "absent"
  const r = el.getBoundingClientRect()
  return `top ${Math.round(r.top)} h ${Math.round(r.height)} bot ${Math.round(r.bottom)}`
}

function collect(): Rows {
  const vv = window.visualViewport
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    // iOS Safari's non-standard flag, still the reliable signal on iOS.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true

  return [
    ["mode", standalone ? "standalone" : "browser tab"],
    ["screen", `${window.screen.width} x ${window.screen.height}`],
    ["window.inner", `${window.innerWidth} x ${window.innerHeight}`],
    ["doc.clientH", String(document.documentElement.clientHeight)],
    [
      "visualViewport",
      vv
        ? `h ${Math.round(vv.height)} offY ${Math.round(vv.offsetTop)} scale ${vv.scale.toFixed(2)}`
        : "unsupported",
    ],
    ["probe 100dvh", String(probeHeight("100dvh"))],
    ["probe 100svh", String(probeHeight("100svh"))],
    ["probe 100lvh", String(probeHeight("100lvh"))],
    ["probe 100vh", String(probeHeight("100vh"))],
    ["probe 100%", String(probeHeight("100%"))],
    ["insets t/r/b/l", probeInsets()],
    ["shell", rect("[data-app-shell]")],
    ["main", rect("[data-app-scroll]")],
    ["nav", rect('nav[aria-label="Main navigation"]')],
  ]
}

export function ViewportDebug() {
  const [rows, setRows] = useState<Rows | null>(null)

  const refresh = useCallback(() => setRows(collect()), [])

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return
    refresh()

    const vv = window.visualViewport
    window.addEventListener("resize", refresh)
    window.addEventListener("orientationchange", refresh)
    vv?.addEventListener("resize", refresh)
    vv?.addEventListener("scroll", refresh)
    // Catch values that only settle after the keyboard animates away.
    const timer = window.setInterval(refresh, 500)

    return () => {
      window.removeEventListener("resize", refresh)
      window.removeEventListener("orientationchange", refresh)
      vv?.removeEventListener("resize", refresh)
      vv?.removeEventListener("scroll", refresh)
      window.clearInterval(timer)
    }
  }, [refresh])

  if (!rows) return null

  return (
    <div
      data-testid="viewport-debug"
      className="pointer-events-none fixed left-1 top-1 z-[9999] rounded bg-black/85 px-2 py-1.5 font-mono text-[10px] leading-tight text-lime-300"
    >
      {rows.map(([label, value]) => (
        <div key={label}>
          <span className="text-lime-500">{label}</span> {value}
        </div>
      ))}
    </div>
  )
}
