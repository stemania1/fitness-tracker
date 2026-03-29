import Link from "next/link"

export const metadata = {
  title: "Terms of Service | Fitness Tracker",
}

export default function TermsOfServicePage() {
  const lastUpdated = "March 29, 2026"
  const appName = "Fitness Tracker"
  const contactEmail = "support@craigfamilywebsite.com"
  const domain = "fitness.craigfamilywebsite.com"

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-purple-600 hover:text-purple-700"
      >
        &larr; Back to home
      </Link>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">
        Terms of Service
      </h1>
      <p className="mb-8 text-sm text-gray-500">Last updated: {lastUpdated}</p>

      <div className="space-y-6 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using {appName} at {domain} (&quot;the
            Service&quot;), you agree to be bound by these Terms of Service. If
            you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            2. Description of Service
          </h2>
          <p>
            {appName} is a personal fitness tracking application designed for
            Planet Fitness members. The Service allows users to create workouts,
            log fitness activity, set goals, and track progress. The Service may
            integrate with third-party devices and services (such as Oura Ring)
            to provide additional health and activity data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            3. User Accounts
          </h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              You must provide a valid email address to create an account.
            </li>
            <li>
              You are responsible for maintaining the security of your account
              credentials.
            </li>
            <li>
              You are responsible for all activity that occurs under your
              account.
            </li>
            <li>You must be at least 13 years old to use the Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            4. Acceptable Use
          </h2>
          <p className="mb-2">You agree not to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              Use the Service for any unlawful purpose or in violation of any
              applicable laws.
            </li>
            <li>
              Attempt to gain unauthorized access to the Service or its related
              systems.
            </li>
            <li>
              Interfere with or disrupt the integrity or performance of the
              Service.
            </li>
            <li>
              Upload or transmit malicious code or content.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            5. Health Disclaimer
          </h2>
          <p>
            The Service provides fitness tracking tools and estimated
            calculations (including calorie estimates) for informational purposes
            only. {appName} is not a medical device and does not provide medical
            advice. Calorie calculations are estimates based on standard
            metabolic formulas and may not be accurate for all individuals.
            Always consult with a qualified healthcare professional before
            starting any exercise program or making changes to your fitness
            routine.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            6. Third-Party Integrations
          </h2>
          <p>
            The Service may integrate with third-party services such as Oura
            Ring. Your use of these integrations is subject to the respective
            third party&apos;s terms of service and privacy policy. We are not
            responsible for the availability, accuracy, or content of
            third-party services.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            7. Intellectual Property
          </h2>
          <p>
            The Service and its original content, features, and functionality are
            owned by {appName} and are protected by applicable copyright and
            other intellectual property laws. Your workout data and personal
            information remain your property.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            8. Limitation of Liability
          </h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, either express or
            implied. We do not warrant that the Service will be uninterrupted,
            secure, or error-free. In no event shall {appName} be liable for any
            indirect, incidental, special, or consequential damages arising from
            your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            9. Account Termination
          </h2>
          <p>
            You may delete your account at any time. We reserve the right to
            suspend or terminate accounts that violate these terms. Upon
            termination, your data will be handled in accordance with our{" "}
            <Link
              href="/privacy"
              className="text-purple-600 hover:text-purple-700 underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            10. Changes to Terms
          </h2>
          <p>
            We reserve the right to modify these Terms of Service at any time.
            Continued use of the Service after changes constitutes acceptance of
            the updated terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            11. Contact Us
          </h2>
          <p>
            If you have questions about these Terms of Service, please contact us
            at{" "}
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
