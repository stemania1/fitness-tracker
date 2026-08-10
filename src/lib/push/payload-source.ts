/**
 * Where a push payload was built — which database it read, and which build
 * of this code read it.
 *
 * `builtAt` answered "when", which was enough to separate a fresh
 * notification from a replayed one. It cannot separate two senders. A
 * reminder whose contents match no row in the database we are looking at is
 * either computed from a different database or sent by something that isn't
 * this deployment, and those have nothing in common to fix — but they look
 * identical on a lock screen, and every attempt to tell them apart so far has
 * needed credentials or server logs that weren't available at the time.
 *
 * So the payload carries its own origin. The Supabase project ref is the part
 * that matters: it is the single fact that distinguishes "the cron computed
 * this from stale data" from "the cron computed this from a different
 * database". It is safe to include — it is the public half of
 * NEXT_PUBLIC_SUPABASE_URL, already shipped in every browser bundle.
 */

/** The pieces of the environment that identify an origin. */
export interface SourceEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string
  VERCEL_GIT_COMMIT_SHA?: string
  /** Present so `process.env` itself is assignable. */
  [key: string]: string | undefined
}

/** Placeholder used when a piece of the environment isn't set. */
const UNKNOWN = "unknown"

/**
 * The Supabase project ref from a project URL — the first label of the host,
 * e.g. `https://abcd1234.supabase.co` → `abcd1234`.
 *
 * Returns null rather than guessing on anything that isn't a URL, so a
 * malformed value shows up as `unknown` instead of as a plausible-looking ref
 * that would send someone comparing it to the dashboard on a long detour.
 */
export function supabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null
  try {
    // hostname, not host: host carries the port, so a local stack arrives as
    // "localhost:54321" and slips past the check below.
    const [ref] = new URL(url).hostname.split(".")
    return ref && ref !== "localhost" ? ref : null
  } catch {
    return null
  }
}

/**
 * A compact origin stamp: `<project-ref>@<commit>`.
 *
 * Both halves are needed. The ref alone cannot distinguish two deployments
 * reading the same database, and the commit alone cannot distinguish two
 * deployments reading different ones — which is the case that has actually
 * bitten.
 */
export function payloadSource(env: SourceEnv = process.env): string {
  const ref = supabaseProjectRef(env.NEXT_PUBLIC_SUPABASE_URL) ?? UNKNOWN
  const sha = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local"
  return `${ref}@${sha}`
}
