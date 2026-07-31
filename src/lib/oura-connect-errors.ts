/**
 * The ways connecting an Oura Ring can fail, and what the user can do about
 * each one.
 *
 * The OAuth callback redirects back with `?oura=error&oura_reason=<reason>`,
 * so these strings are a contract with `api/auth/oura/callback` — a reason it
 * emits that isn't listed here falls through to no guidance at all, which is
 * why the guard and the callback's set are covered by a test.
 */

export type OuraErrorReason =
  | "user_denied"
  | "missing_code"
  | "missing_env"
  | "token_exchange"
  | "not_authenticated"
  | "db_write"

export const ouraErrorInfo: Record<OuraErrorReason, { title: string; steps: string[] }> = {
  user_denied: {
    title: "Authorization was denied on Oura's site.",
    steps: [
      "Click \"Connect\" again and make sure to tap \"Allow\" when Oura asks for permission.",
      "If you didn't intend to deny access, your browser may have blocked the pop-up — check your pop-up blocker settings.",
    ],
  },
  missing_code: {
    title: "No authorization code was received from Oura.",
    steps: [
      "Try connecting again — the previous request may have expired or been interrupted.",
      "Make sure you're not using a browser extension that strips URL parameters.",
      "Clear your browser cookies for cloud.ouraring.com and try again.",
    ],
  },
  missing_env: {
    title: "The Oura integration is not configured on the server.",
    steps: [
      "This is a server configuration issue — please contact support.",
      "If you are the site admin, verify that OURA_CLIENT_ID and OURA_CLIENT_SECRET are set in your environment variables.",
    ],
  },
  token_exchange: {
    title: "Failed to exchange your authorization for an access token.",
    steps: [
      "This is usually a temporary issue — wait a minute and try connecting again.",
      "Make sure your Oura account is in good standing at cloud.ouraring.com.",
      "Check that your internet connection is stable.",
      "If the problem persists, the Oura API may be experiencing downtime — try again later.",
    ],
  },
  not_authenticated: {
    title: "Your session expired during the Oura connection flow.",
    steps: [
      "Log in again, then go to Profile and click \"Connect\" to retry.",
      "Avoid leaving the Oura authorization page open for too long before approving.",
    ],
  },
  db_write: {
    title: "Your Oura tokens were received but couldn't be saved.",
    steps: [
      "Try connecting again — this is usually a transient database issue.",
      "If the problem persists, contact support and mention error code \"db_write\".",
    ],
  },
}

/**
 * `in` walks the prototype chain, so it accepted "toString", "constructor" and
 * friends — the lookup then yielded a function and rendering it as guidance
 * threw on `.steps.map`. The reason comes straight from a URL parameter, so
 * that was a crash a hand-edited link could trigger.
 */
export function isOuraErrorReason(value: string): value is OuraErrorReason {
  return Object.prototype.hasOwnProperty.call(ouraErrorInfo, value)
}
