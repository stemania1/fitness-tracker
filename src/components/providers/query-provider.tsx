"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { watchAuthChanges } from "@/lib/supabase/user-query"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000 },
        },
      })
  )

  // Keep the session-cached auth user in step with the real session.
  useEffect(() => watchAuthChanges(), [])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
