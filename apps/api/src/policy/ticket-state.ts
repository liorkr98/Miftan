import { ApiError, type TicketStatus } from '@miftan/shared';
import type { Scope } from './viewer.ts';

/**
 * The ticket lifecycle, as a table.
 *
 * Written down in one place rather than as conditionals spread across route
 * handlers, because the interesting bugs here are the transitions nobody
 * thought about: closing a ticket that was never approved, assigning a vendor
 * twice, a tenant marking their own repair complete. A table makes the illegal
 * moves visible by their absence.
 *
 * The client is never trusted with this. The prototype's UI only offered the
 * valid next action, which is good design and no defence at all — anyone can
 * post whatever they like to an endpoint.
 */

export type TicketAction =
  | 'approve'
  | 'reject'
  | 'assign'
  | 'start'
  | 'request_receipt'
  | 'close'
  | 'reopen';

interface Transition {
  from: TicketStatus[];
  to: TicketStatus;
  /** Which relationship to the property may perform it */
  by: Scope[];
  /** Human reason, surfaced when a transition is refused */
  why: string;
}

export const TRANSITIONS: Record<TicketAction, Transition> = {
  approve: {
    from: ['new'],
    to: 'approved',
    by: ['owner'],
    why: 'only a new ticket can be approved, and only by the owner',
  },
  reject: {
    from: ['new'],
    to: 'closed',
    by: ['owner'],
    why: 'only a new ticket can be rejected',
  },
  /* Re-assignment is legitimate — the first tradesperson cancels, or turns out
     to be wrong for the job — so `assigned` is both a source and a target. */
  assign: {
    from: ['approved', 'assigned'],
    to: 'assigned',
    by: ['owner'],
    why: 'a ticket must be approved before a tradesperson can be booked',
  },
  start: {
    from: ['assigned'],
    to: 'in_progress',
    by: ['owner'],
    why: 'work can only start once somebody is booked',
  },
  request_receipt: {
    from: ['in_progress'],
    to: 'awaiting_receipt',
    by: ['owner'],
    why: 'a receipt can only be requested once the work has started',
  },
  /* Closing without a receipt is allowed: plenty of jobs cost nothing, and
     forcing a fake receipt would be worse than recording no expense. */
  close: {
    from: ['in_progress', 'awaiting_receipt'],
    to: 'closed',
    by: ['owner'],
    why: 'a ticket can only be closed once the work is under way',
  },
  reopen: {
    from: ['closed'],
    to: 'approved',
    by: ['owner'],
    why: 'only a closed ticket can be reopened',
  },
};

export function nextStatus(
  action: TicketAction,
  current: TicketStatus,
  scope: Scope,
): TicketStatus {
  const transition = TRANSITIONS[action];

  if (!transition.by.includes(scope)) {
    throw new ApiError('forbidden', transition.why);
  }
  if (!transition.from.includes(current)) {
    throw new ApiError(
      'forbidden',
      `cannot ${action} a ticket that is "${current}" — ${transition.why}`,
    );
  }
  return transition.to;
}

/**
 * What this viewer could legally do next. Lets the UI stay in step without
 * hardcoding the same rules a second time.
 */
export function availableActions(current: TicketStatus, scope: Scope): TicketAction[] {
  return (Object.keys(TRANSITIONS) as TicketAction[]).filter((action) => {
    const t = TRANSITIONS[action];
    return t.by.includes(scope) && t.from.includes(current);
  });
}

/** A receipt closes the ticket, so it is only meaningful while one is open. */
export const RECEIPT_ALLOWED_FROM: TicketStatus[] = ['in_progress', 'awaiting_receipt'];
