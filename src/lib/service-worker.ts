/**
 * Register the web-push service worker and force an update check on every app
 * load.
 *
 * The worker was only ever registered from inside `enablePush()`, so an
 * installed PWA that already had push enabled would keep running whatever
 * worker it first installed — potentially a stale one from before a
 * notification-rendering fix. The push service still accepts the message
 * (the send reports success), but the old worker never draws a banner, so
 * nothing appears on the device. Registering here on startup, plus calling
 * `update()` to pull the newest bytes immediately rather than waiting on the
 * browser's ~24h update heuristic, lets the current worker's `skipWaiting()` /
 * `clients.claim()` take over on the next launch.
 */
export async function registerServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return
  }
  try {
    const registration = await navigator.serviceWorker.register("/sw.js")
    await registration.update()
  } catch {
    // Never let a failed registration break app boot; push simply won't work
    // until a later load registers successfully.
  }
}
