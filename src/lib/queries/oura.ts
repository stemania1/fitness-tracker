"use client"

import { queryOptions } from "@tanstack/react-query"
import type { OuraSummary } from "@/lib/oura"
import { localToday, localUtcOffset } from "@/lib/dates"
import { queryKeys } from "@/lib/queries/keys"

export interface OuraSummaryResult {
  connected: boolean
  summary: OuraSummary | null
  error?: "token_expired" | "fetch_failed"
}

/**
 * Today's Oura summary.
 *
 * This fetcher — timezone-offset arithmetic, three status-code branches and
 * all — existed twice, character for character, in the dashboard page and in
 * OuraSummaryCard. They shared a cache key, so the fetch did happen once;
 * but which of the two copies actually ran depended on mount order, and an
 * edit to one would silently do nothing half the time.
 *
 * A 404 means no ring is connected — that is a normal state, not an error, so
 * it resolves rather than throws. `retry: false` because none of these
 * outcomes gets better by asking again.
 */
export function ouraSummaryQuery() {
  return queryOptions<OuraSummaryResult>({
    queryKey: queryKeys.ouraSummary,
    queryFn: async () => {
      const params = new URLSearchParams({
        date: localToday(),
        tz_offset: localUtcOffset(),
      })
      const res = await fetch(`/api/oura?${params}`)
      if (res.status === 404) return { connected: false, summary: null }
      if (res.status === 401)
        return { connected: true, summary: null, error: "token_expired" }
      if (!res.ok)
        return { connected: true, summary: null, error: "fetch_failed" }
      return { connected: true, summary: (await res.json()) as OuraSummary }
    },
    retry: false,
  })
}
