/* CraigFitness service worker — handles web-push reminder notifications. */

// Bump on every meaningful change to this file. It doubles as a cache-buster
// (changed bytes trigger the browser's SW update) and a diagnostic: the worker
// broadcasts it on activate so a client can confirm which version is live.
const SW_VERSION = 2

// Take over as soon as a new version is available. Without this the previous
// worker keeps handling pushes until every tab closes, so notification fixes
// wouldn't reach an installed PWA that's never fully quit.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) =>
  event.waitUntil(
    self.clients.claim().then(async () => {
      const clients = await self.clients.matchAll({ includeUncontrolled: true })
      for (const client of clients) {
        client.postMessage({ type: "sw-activated", version: SW_VERSION })
      }
    })
  )
)

/** A reminder older than this describes a day that has moved on. */
const MAX_REMINDER_AGE_MS = 2 * 60 * 60 * 1000

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  // A reminder's text is a statement about right now — "it's been 3 days
  // since your last workout" — computed when the push was built. iOS holds
  // pushes for a device that is asleep, in Low Power Mode, or off the network,
  // and delivers them later; the text does not update in flight. Showing one
  // hours late means asserting something that has since stopped being true.
  //
  // Only reminders carry builtAt, so anything without it (a test push, or a
  // sender that isn't the reminder cron) is shown as before.
  if (data.builtAt) {
    const ageMs = Date.now() - Date.parse(data.builtAt)
    if (Number.isFinite(ageMs) && ageMs > MAX_REMINDER_AGE_MS) return
  }

  const title = data.title || "CraigFitness"
  const options = {
    body: data.body || "",
    // PNG, not SVG: Safari refuses to render a notification whose icon is an
    // SVG, so the push arrives but nothing ever appears on screen.
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Reminders share a tag so a new one replaces the last instead of
    // stacking; a test push passes its own tag so it always shows.
    tag: data.tag || "craigfitness-reminder",
    data: { url: data.url || "/dashboard" },
  }
  event.waitUntil(
    self.registration.showNotification(title, options).catch(() =>
      // Never let a bad icon/option swallow the notification entirely.
      self.registration.showNotification(title, { body: options.body })
    )
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/dashboard"
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        return self.clients.openWindow(url)
      })
  )
})
