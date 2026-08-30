import type { AvailabilityConfidence, RenewalIntent, UnitStatus } from '../types';

/**
 * The availability signal — the one thing the seeker side is allowed to know
 * about an occupied apartment.
 *
 * This is the single place where a tenant's private answer is turned into a
 * public fact. It reads `renewalIntent`, which is tenant data, and returns a
 * kind, a date and a confidence, which are not. Nothing else on the seeker path
 * may touch the intent — everything goes through here.
 *
 * Keeping it in shared means the API and the UI cannot disagree about what an
 * apartment's status means, which matters because the whole product rests on
 * that answer being trustworthy.
 */

export type AvailabilityKind =
  /** Empty today */
  | 'now'
  /** Occupied, but with a date worth planning around */
  | 'dated'
  /** Occupied and the tenant intends to stay */
  | 'extending'
  /** Occupied and nobody has asked yet — the state this product exists to fix */
  | 'unknown';

export interface AvailabilityInput {
  status: UnitStatus;
  /** ISO date, or null when there is nothing to publish */
  availableFrom: string | null;
  confidence: AvailabilityConfidence;
  /** Private. Read here and nowhere else on a seeker-facing path. */
  renewalIntent: RenewalIntent | null;
}

export interface AvailabilitySignal {
  kind: AvailabilityKind;
  /** Only set when the kind justifies publishing one */
  date: string | null;
  confidence: AvailabilityConfidence;
  /** True when a seeker can usefully ask the owner to find out */
  askable: boolean;
}

export function deriveAvailability(input: AvailabilityInput): AvailabilitySignal {
  const { status, availableFrom, confidence, renewalIntent } = input;

  if (status === 'vacant') {
    return { kind: 'now', date: null, confidence: 'confirmed', askable: false };
  }

  /* The tenant said they are staying. Publish that they are likely to stay,
     and no date — a lease end date the tenant intends to renew past is not an
     availability date, and showing it would be a lie by implication. */
  if (renewalIntent === 'extend') {
    return { kind: 'extending', date: null, confidence: 'unknown', askable: true };
  }

  /* A date only becomes public once somebody has actually confirmed or
     projected it. An untouched lease end date stays private. */
  if (availableFrom && confidence !== 'unknown') {
    return { kind: 'dated', date: availableFrom, confidence, askable: confidence === 'likely' };
  }

  return { kind: 'unknown', date: null, confidence: 'unknown', askable: true };
}
