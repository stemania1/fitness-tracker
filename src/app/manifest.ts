import type { MetadataRoute } from "next"

/**
 * Web app manifest so the app installs cleanly to the phone home screen as a
 * standalone PWA. Launching from the installed icon (rather than a Safari
 * tab) gives the app durable storage that isn't subject to the browser's
 * cookie-clearing, so the Supabase login session persists across visits.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fitness Tracker",
    short_name: "Fitness Tracker",
    description: "Track your workouts and reach your goals",
    // Open straight to the dashboard; middleware routes to /login if the
    // session has actually expired.
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#9333ea",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  }
}
