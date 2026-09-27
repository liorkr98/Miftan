/**
 * What Launch 1 (closed beta) ships, and what stays off until Launch 2.
 *
 * A demo build turns every flag on. Production reads this list. Hiding a
 * half-built screen is the alternative to pretending it works.
 */
export const launchFeatures = {
  /** Seeker marketplace, public listings, map. Launch 2. */
  marketplace: false,
  /** A general inbox. Ticket conversations stay. Launch 2. */
  generalMessaging: false,
  /** The scanner reads plain text only. Hidden until it reads PDFs. */
  contractScan: false,
  /** Affiliate offers. Hidden until the contracts exist. */
  affiliates: false,
  /** Illustrated income points. Demo only — not a billed feature. */
  revenueLens: false,
} as const;

export type LaunchFeature = keyof typeof launchFeatures;

export function featureEnabled(flag: LaunchFeature, demoBuild: boolean): boolean {
  return demoBuild || launchFeatures[flag];
}
