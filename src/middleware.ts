import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // PWA assets must never be auth-gated. The service worker, manifest, and
  // apple-touch-icon don't end in an excluded image extension, so without
  // naming them here an unauthenticated fetch gets redirected to /login and
  // receives HTML — which silently breaks service-worker registration (and
  // therefore push notifications) and the install prompt.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
