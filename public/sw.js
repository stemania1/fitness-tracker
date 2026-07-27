/* CraigFitness service worker — handles web-push reminder notifications. */

// Take over as soon as a new version is available. Without this the previous
// worker keeps handling pushes until every tab closes, so notification fixes
// wouldn't reach an installed PWA that's never fully quit.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
)

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
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
