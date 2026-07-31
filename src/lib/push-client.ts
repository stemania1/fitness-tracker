/**
 * Browser-side web-push helpers: feature detection, subscribe (register the
 * service worker, request permission, hand the subscription to the API) and
 * unsubscribe. All UI orchestration lives in the caller; these just do the
 * platform dance and the API round-trips.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/** Web push needs a service worker, the Push API, and the Notification API. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY
  )
}

/** Current Notification permission, or "unsupported". */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported"
  return Notification.permission
}

/** Is there already an active push subscription in this browser? */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return !!sub
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * Register the SW, prompt for permission, subscribe, and persist the
 * subscription + the browser's timezone (the cron needs it). Throws with a
 * user-facing message on denial or failure.
 */
export async function enablePush(): Promise<void> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) {
    throw new Error("Push notifications aren't supported on this device.")
  }
  const reg = await navigator.serviceWorker.register("/sw.js")
  await navigator.serviceWorker.ready

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.")
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    // Uint8Array is a valid BufferSource; the lib types are over-narrow here.
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), timezone }),
  })
  if (!res.ok) throw new Error("Couldn't save the subscription. Try again.")
}

/**
 * Re-send the existing subscription (and the current timezone) if this browser
 * already has one. Safe to call on every load — the API upserts on endpoint.
 *
 * This exists because the scheduled sender SKIPS any user with no
 * `user_profiles.timezone`, silently and permanently: it cannot work out their
 * local hour, so it can't respect quiet hours or time-gating. The timezone was
 * only ever written at subscribe time, so anyone who enabled push before that
 * column existed — or whose profile update failed — gets no reminders forever,
 * while the "send test notification" button still works because that path
 * needs no timezone. Re-sending on load heals those rows, and keeps the zone
 * current if the user travels.
 *
 * Never throws: this runs on app boot and must not break it. Returns whether
 * a subscription was found and successfully re-sent.
 */
export async function refreshPushSubscription(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return false
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), timezone }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Remove the local subscription and delete it server-side. */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  })
  await sub.unsubscribe()
}
