import type { Metadata } from "next"
import "./globals.css"
import { QueryProvider } from "@/components/providers/query-provider"

export const metadata: Metadata = {
  title: "CraigFitness",
  description: "Track your workouts and reach your goals",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CraigFitness",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Required by `statusBarStyle: "black-translucent"` above: that style makes
  // the web view span the full screen, and without `viewport-fit: cover` iOS
  // resolves every `env(safe-area-inset-*)` to 0. The bottom nav's
  // home-indicator padding was silently a no-op until this was set.
  viewportFit: "cover" as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
