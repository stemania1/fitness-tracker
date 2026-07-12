export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { TopBar } from "@/components/layout/top-bar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { OfflineSyncManager } from "@/components/activity/OfflineSyncManager"

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
      <main className="flex-1 overflow-x-hidden px-4 py-6 pb-24">{children}</main>
      <OfflineSyncManager />
      <BottomNav />
    </div>
  )
}
