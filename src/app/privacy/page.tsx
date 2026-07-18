import Link from "next/link"

export const metadata = {
  title: "Privacy Policy | CraigFitness",
}

export default function PrivacyPolicyPage() {
  const lastUpdated = "March 29, 2026"
  const appName = "CraigFitness"
  const contactEmail = "privacy@craigfamilywebsite.com"
  const domain = "fitness.craigfamilywebsite.com"

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-purple-600 hover:text-purple-700"
      >
        &larr; Back to home
      </Link>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mb-8 text-sm text-gray-500">Last updated: {lastUpdated}</p>

      <div className="space-y-6 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            1. Introduction
          </h2>
          <p>
            {appName} (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
            operates the fitness tracking application at {domain}. This Privacy
            Policy explains how we collect, use, and protect your personal
            information when you use our service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            2. Information We Collect
          </h2>
          <p className="mb-2">We collect the following types of information:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Account information:</strong> Email address and password
              when you create an account.
            </li>
            <li>
              <strong>Profile information:</strong> Name, age, sex, height,
              weight, fitness level, and fitness goals that you voluntarily
              provide during onboarding.
            </li>
            <li>
              <strong>Workout data:</strong> Exercises performed, sets, reps,
              weights, duration, and other activity data you log.
            </li>
            <li>
              <strong>Third-party integrations:</strong> If you connect
              third-party services (such as Oura Ring), we receive data you
              authorize those services to share, which may include sleep data,
              heart rate, activity metrics, readiness scores, and body
              temperature.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            3. How We Use Your Information
          </h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>To provide and personalize the fitness tracking service.</li>
            <li>
              To generate workout recommendations based on your fitness level and
              goals.
            </li>
            <li>To calculate and display progress metrics and calorie estimates.</li>
            <li>To display health data from connected third-party devices.</li>
            <li>To improve the application and user experience.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            4. Data Storage and Security
          </h2>
          <p>
            Your data is stored securely using Supabase, which provides
            encrypted database storage and authentication. All data transmission
            uses HTTPS encryption. We use Row Level Security (RLS) to ensure
            users can only access their own data. We do not sell, rent, or share
            your personal data with third parties for marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            5. Third-Party Services
          </h2>
          <p>
            We may integrate with third-party services (such as Oura) to enhance
            your experience. When you connect a third-party service, you
            authorize us to access specific data from that service. You can
            disconnect third-party services at any time from your profile
            settings, which will stop future data collection from that service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            6. Data Retention and Deletion
          </h2>
          <p>
            We retain your data for as long as your account is active. You may
            request deletion of your account and all associated data at any time
            by contacting us at {contactEmail}. Upon account deletion, all
            personal data will be permanently removed from our systems.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            7. Your Rights
          </h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>Access and download your personal data.</li>
            <li>Correct inaccurate information in your profile.</li>
            <li>Request deletion of your account and data.</li>
            <li>Disconnect third-party integrations at any time.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            8. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of significant changes by posting a notice within the
            application.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            9. Contact Us
          </h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-purple-600 hover:text-purple-700 underline"
            >
              {contactEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
