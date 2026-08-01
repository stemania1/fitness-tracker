"use client"

import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

/**
 * The signed-in user's id, resolved once per session.
 *
 * Every query in the app opened with the same preamble:
 *
 *     const { data: { user } } = await supabase.auth.getUser()
 *     if (!user) throw new Error("Not authenticated")
 *
 * `getUser()` is not a local read — it round-trips `/auth/v1/user` to validate
 * the JWT on every call. A single dashboard mount fires ~24 read queries, so
 * that preamble alone was ~24 sequential auth requests before any data moved.
 *
 * Caching the id is safe because it is never an authorization decision: it
 * only builds `.eq("user_id", …)` filters, and RLS enforces the actual access
 * check server-side on every request. A stale or expired token fails at the
 * database, not here.
 */
let pendingUser: Promise<User> | null = null

/** The signed-in user, resolved once per session. Throws if signed out. */
export function getAuthUser(): Promise<User> {
  if (!pendingUser) {
    pendingUser = supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!user) throw new Error("Not authenticated")
        return user
      })
      .catch((err) => {
        // Don't cache a rejection — the next caller should retry rather than
        // inherit a failure from a transient network blip.
        pendingUser = null
        throw err
      })
  }
  return pendingUser
}

export async function getAuthUserId(): Promise<string> {
  return (await getAuthUser()).id
}

/** Drop the cached user. Exported for tests and for the auth listener below. */
export function resetAuthUserId(): void {
  pendingUser = null
}

/**
 * Clear the cached user whenever the session changes — signing in or out
 * swaps which user the cache refers to, so it must not outlive its session.
 *
 * Called from QueryProvider rather than run as an import side effect: a
 * module-level subscription fires on any import of this file, including in
 * tests whose Supabase doubles only stub the methods they use.
 *
 * Returns an unsubscribe function.
 */
export function watchAuthChanges(): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      resetAuthUserId()
    }
  })
  return () => data.subscription.unsubscribe()
}

/**
 * `useQuery` for the common case: a read scoped to the signed-in user.
 *
 * The user id is threaded in rather than re-fetched, so call sites drop the
 * preamble and the auth round-trip happens once per session instead of once
 * per query.
 */
export function useUserQuery<T>(
  queryKey: QueryKey,
  queryFn: (userId: string) => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error, T, QueryKey>, "queryKey" | "queryFn">
) {
  return useQuery<T, Error, T, QueryKey>({
    ...options,
    queryKey,
    queryFn: async () => queryFn(await getAuthUserId()),
  })
}
