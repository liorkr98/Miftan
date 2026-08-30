import type { TicketStatus } from '@miftan/shared';

/** Everything that still needs somebody to do something. */
export const OPEN_TICKET_STATUSES: TicketStatus[] = [
  'new',
  'approved',
  'assigned',
  'in_progress',
  'awaiting_receipt',
];
