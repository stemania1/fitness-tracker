import type { Metadata } from "next"
import "./globals.css"
import { QueryProvider } from "@/components/providers/query-provider"

export const metadata: Metadata = {
  title: "PF Fitness Tracker",
  description: "Track your Planet Fitness workouts and reach your goals",
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
