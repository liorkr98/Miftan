import { randomUUID } from 'node:crypto';

/**
 * Prefixed IDs. `prop_a1b2…` tells you what you are looking at in a log, a
 * failing test or a support ticket; a bare UUID does not.
 */
export const ID_PREFIX = {
  user: 'usr',
  property: 'prop',
  lease: 'lease',
  guarantor: 'gtr',
  vendor: 'vnd',
  ticket: 'tkt',
  ticketMessage: 'tmsg',
  expense: 'exp',
  rentPayment: 'rent',
  lead: 'lead',
  inquiry: 'inq',
  thread: 'thr',
  threadMessage: 'msg',
  protocolRun: 'prun',
  protocolEntry: 'pent',
  seasonalTask: 'stask',
  screeningPreset: 'spre',
  audit: 'aud',
  contractScan: 'scan',
} as const;

export type IdKind = keyof typeof ID_PREFIX;

export function newId(kind: IdKind): string {
  return `${ID_PREFIX[kind]}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

/**
 * Stable id for seeded rows, so re-running the seed produces the same ids and
 * fixtures can be referenced by name across files.
 */
export function seedId(kind: IdKind, key: string): string {
  return `${ID_PREFIX[kind]}_seed_${key}`;
}
