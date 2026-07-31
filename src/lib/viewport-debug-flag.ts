/**
 * On/off state for the viewport diagnostic overlay.
 *
 * Lives outside the component because there are two ways in, and they serve
 * different situations:
 *
 *   - `?debug=viewport` in the URL — fine in a browser tab.
 *   - A toggle in the app — the ONLY way in an installed PWA, which launches at
 *     the manifest's `start_url`, has no address bar to type a query string
 *     into, and keeps storage separate from the browser that installed it. The
 *     standalone app is the one place the layout bugs reproduce, so a
 *     URL-only switch was useless exactly where it was needed.
 */

const STORAGE_KEY = "craigfitness:viewport-debug"

/** Fired when the flag changes so a mounted overlay reacts without a reload. */
export const VIEWPORT_DEBUG_EVENT = "craigfitness:viewport-debug-changed"

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * Whether the overlay should show. `?debug=viewport` turns it on and persists
 * it; `?debug=off` clears it; otherwise the stored choice stands.
 */
export function isViewportDebugOn(search: string = window.location.search): boolean {
  const q = new URLSearchParams(search).get("debug")
  if (q === "viewport") {
    setViewportDebug(true)
    return true
  }
  if (q === "off") {
    setViewportDebug(false)
    return false
  }
  return readStored()
}

export function setViewportDebug(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1")
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode: the overlay still works for this page view.
  }
  window.dispatchEvent(new Event(VIEWPORT_DEBUG_EVENT))
}
