import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/** Delete a push subscription for the signed-in user by endpoint. */
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let endpoint: unknown
  try {
    endpoint = (await request.json())?.endpoint
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }

  if (typeof endpoint === "string" && endpoint.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
  }

  return NextResponse.json({ ok: true })
}
