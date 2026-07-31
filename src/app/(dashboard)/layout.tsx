export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { TopBar } from "@/components/layout/top-bar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { OfflineSyncManager } from "@/components/activity/OfflineSyncManager"
import { ServiceWorkerManager } from "@/components/pwa/ServiceWorkerManager"
import { ViewportDebug } from "@/components/pwa/ViewportDebug"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_done")
    .eq("id", user.id)
    .single()

  if (!profile?.onboarding_done) {
    redirect("/onboarding")
  }

  return (
    /* App-shell layout: the outer box is exactly one viewport tall and never
       scrolls, <main> is the only scroller, and TopBar/BottomNav are ordinary
       flex children pinned by layout rather than by `position: fixed`. iOS
       anchors fixed elements to the visual viewport, which the software
       keyboard shrinks and does not reliably restore — that is what stranded
       the nav mid-screen. In flow, there is nothing left to mis-anchor. */
    <div
      data-app-shell
      className="flex h-full flex-col overflow-hidden bg-gray-50"
    >
      <TopBar />
      {/* `data-app-scroll` marks this as the scroll container so modal scroll
          locking can target it (the body no longer scrolls). */}
      <main
        data-app-scroll
        className="min-h-0 flex-1 overflow-y-auto overflow-x-clip px-4 py-6"
      >
        {children}
      </main>
      <OfflineSyncManager />
      <ServiceWorkerManager />
      {/* Renders only with ?debug=viewport in the URL. */}
      <ViewportDebug />
      <BottomNav />
    </div>
  )
}
