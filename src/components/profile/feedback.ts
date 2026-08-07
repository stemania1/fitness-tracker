/**
 * The profile page owns a single feedback banner; every settings card on the
 * page (profile form, Oura connection, account) reports success/error through
 * this shape instead of rendering its own. One type, not three copies drifting.
 */
export interface ProfileFeedback {
  type: "success" | "error"
  text: string
}
