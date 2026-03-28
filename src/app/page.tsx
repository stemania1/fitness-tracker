import Link from "next/link"
import { Dumbbell, Target, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"

const features = [
  {
    icon: Dumbbell,
    title: "Log Workouts",
    description: "Easily track every exercise, set, and rep during your gym sessions.",
  },
  {
    icon: Target,
    title: "Set Goals",
    description: "Define personal fitness goals and stay on track with progress milestones.",
  },
  {
    icon: TrendingUp,
    title: "Track Progress",
    description: "Visualize your improvement over time with detailed charts and stats.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-purple-600" />
            <span className="text-xl font-bold text-gray-900">PF Fitness Tracker</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1.5 text-sm font-medium text-purple-700 mb-6">
            <Dumbbell className="h-4 w-4" />
            Planet Fitness Companion
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            PF Fitness Tracker
          </h1>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Your personal workout companion for Planet Fitness. Log workouts, set
            goals, and track your progress — all in one place.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="secondary">
                Log In
              </Button>
            </Link>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                  <feature.icon className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 text-center text-sm text-gray-400">
        &copy; {new Date().getFullYear()} PF Fitness Tracker. All rights reserved.
      </footer>
    </div>
  )
}
