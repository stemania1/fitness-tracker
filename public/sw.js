/* CraigFitness service worker — handles web-push reminder notifications. */

// Bump on every meaningful change to this file. It doubles as a cache-buster
// (changed bytes trigger the browser's SW update) and a diagnostic: the worker
// broadcasts it on activate so a client can confirm which version is live.
const SW_VERSION = 3

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

// Received-push log. Both constants are duplicated from
// src/lib/push/received-log.ts, which this file cannot import — it is plain
// JavaScript served as-is. Change them together: a mismatch detaches this
// writer from the Diagnostics reader, which then shows nothing and looks
// exactly like "no pushes have arrived".
const RECEIVED_CACHE = "craigfitness-received-v1"
const RECEIVED_URL = "/__push-received"
const RECEIVED_MAX = 10

/**
 * Record a push exactly as it arrived, including one being dropped.
 *
 * A dropped push is the more interesting of the two: it is the evidence that
 * something was delivered late, and dropping it silently destroys the only
 * copy of that evidence. Never throws — a failure to journal must not cost
 * the user the notification.
 */
async function recordReceived(entry) {
  try {
    const cache = await caches.open(RECEIVED_CACHE)
    const previous = await cache.match(RECEIVED_URL)
    const list = previous ? await previous.json() : []
    const next = [entry, ...(Array.isArray(list) ? list : [])].slice(0, RECEIVED_MAX)
    await cache.put(
      RECEIVED_URL,
      new Response(JSON.stringify(next), {
        headers: { "Content-Type": "application/json" },
      })
    )
  } catch {
    // Diagnostics are worth less than delivery.
  }
}

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
  let stale = false
  if (data.builtAt) {
    const ageMs = Date.now() - Date.parse(data.builtAt)
    stale = Number.isFinite(ageMs) && ageMs > MAX_REMINDER_AGE_MS
  }

  const journal = recordReceived({
    receivedAt: new Date().toISOString(),
    builtAt: typeof data.builtAt === "string" ? data.builtAt : null,
    source: typeof data.source === "string" ? data.source : null,
    title: data.title || "",
    body: data.body || "",
    shown: !stale,
  })

  if (stale) {
    event.waitUntil(journal)
    return
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
    Promise.all([
      journal,
      self.registration.showNotification(title, options).catch(() =>
        // Never let a bad icon/option swallow the notification entirely.
        self.registration.showNotification(title, { body: options.body })
      ),
    ])
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
