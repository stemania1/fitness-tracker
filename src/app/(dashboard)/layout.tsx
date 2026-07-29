export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { TopBar } from "@/components/layout/top-bar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { OfflineSyncManager } from "@/components/activity/OfflineSyncManager"
import { ServiceWorkerManager } from "@/components/pwa/ServiceWorkerManager"

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
    <div className="flex min-h-screen flex-col bg-gray-50">
      <TopBar />
      {/* overflow-x-CLIP, not hidden: `overflow-x: hidden` forces the computed
          `overflow-y` to `auto` (CSS overflow spec), turning <main> into a
          scroll container. iOS then anchors the fixed bottom nav to that inner
          scroller's initial frame, so it drifts during normal scrolling in the
          installed PWA. `clip` contains runaway horizontal content without
          making <main> a scroller, so the document body scrolls and the nav
          stays pinned to the viewport. */}
      <main className="flex-1 overflow-x-clip px-4 py-6 pb-24">{children}</main>
      <OfflineSyncManager />
      <ServiceWorkerManager />
      <BottomNav />
    </div>
  )
}
