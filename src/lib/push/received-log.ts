/**
 * What actually arrived on this device, readable from inside the app.
 *
 * Every explanation for a wrong reminder so far has needed something the
 * phone holding the wrong reminder doesn't have: the service key, or Vercel's
 * runtime logs. Meanwhile the one artifact that definitely exists — the
 * payload itself — was read once off a lock screen and then gone, carrying no
 * record of when it was built, what sent it, or whether the service worker
 * chose to show it.
 *
 * The service worker now writes every push it receives here, including ones
 * it drops as stale, and Diagnostics reads it back. A wrong notification
 * becomes self-describing: its `builtAt` says whether it was fresh, its
 * `source` says which database and which build produced it.
 *
 * Storage is the Cache API rather than IndexedDB: a service worker and a page
 * can both reach it with no schema, no upgrade path, and no library, and a
 * JSON body under a synthetic URL is the whole format.
 *
 * The two constants below are duplicated verbatim in `public/sw.js`, which is
 * plain JavaScript served as-is and cannot import this module. Changing one
 * without the other silently detaches the writer from the reader — the panel
 * would simply show nothing, which is indistinguishable from "no pushes have
 * arrived" and would be believed.
 */

/** Cache holding the received-push log. Mirrored in public/sw.js. */
export const RECEIVED_CACHE = "craigfitness-received-v1"
/** Synthetic request key for the log entry. Mirrored in public/sw.js. */
export const RECEIVED_URL = "/__push-received"

/** One push, as the service worker saw it. */
export interface ReceivedPush {
  /** When the service worker handled it, ISO. */
  receivedAt: string
  /** The payload's own `builtAt`, or null if it carried none. */
  builtAt: string | null
  /** The payload's `source` stamp, or null if it carried none. */
  source: string | null
  title: string
  body: string
  /** False when the worker dropped it for being stale. */
  shown: boolean
}

/** Coerce one cached record into a ReceivedPush, or null if unusable. */
function normalize(raw: unknown): ReceivedPush | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.receivedAt !== "string") return null
  return {
    receivedAt: r.receivedAt,
    builtAt: typeof r.builtAt === "string" ? r.builtAt : null,
    source: typeof r.source === "string" ? r.source : null,
    title: typeof r.title === "string" ? r.title : "",
    body: typeof r.body === "string" ? r.body : "",
    shown: r.shown !== false,
  }
}

/** Parse the cached JSON body into entries, newest first. */
export function parseReceived(raw: unknown): ReceivedPush[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalize).filter((e): e is ReceivedPush => e !== null)
}

/**
 * How long a payload sat between being built and being received.
 *
 * This is the number that separates "the cron computed the wrong thing" from
 * "the right thing was computed and delivered late": a lag of minutes means
 * the contents were current when they arrived, so a wrong claim was wrong at
 * the source. Null when the payload carried no `builtAt` — which is itself
 * the answer, since everything this code sends now carries one.
 */
export function deliveryLagMs(entry: ReceivedPush): number | null {
  if (!entry.builtAt) return null
  const built = Date.parse(entry.builtAt)
  const received = Date.parse(entry.receivedAt)
  if (!Number.isFinite(built) || !Number.isFinite(received)) return null
  return received - built
}

/** A lag rendered for the panel: "12s", "4m", "2h 5m". */
export function formatLag(ms: number | null): string {
  if (ms == null) return "unknown"
  if (ms < 0) return "0s"
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 1) return `${Math.floor(ms / 1000)}s`
  if (totalMinutes < 60) return `${totalMinutes}m`
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
}

/**
 * Read the log. Never throws: this feeds a diagnostics panel, and a panel
 * that breaks the page it sits on is worse than one that shows nothing.
 */
export async function readReceivedPushes(): Promise<ReceivedPush[]> {
  try {
    if (typeof caches === "undefined") return []
    const cache = await caches.open(RECEIVED_CACHE)
    const hit = await cache.match(RECEIVED_URL)
    if (!hit) return []
    return parseReceived(await hit.json())
  } catch {
    return []
  }
}
