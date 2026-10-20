import { z } from 'zod';

/**
 * The notification feed.
 *
 * Derived on read from the rows that already exist — a new ticket, a tenant's
 * answer, an owner's reply — never stored as a second copy that could drift
 * from the first. Each item is shaped for the role it is addressed to, under
 * the same rules as every other response: a seeker never learns anything
 * about the tenant, a tenant never learns who is asking about their flat.
 *
 * The server sends a kind and its facts; the client turns them into Hebrew,
 * so the i18n seam stays in `he.ts`.
 */

export const notificationKindSchema = z.enum([
  /* owner */
  'ticket_new',
  'receipt_uploaded',
  'lead_new',
  'inquiry_new',
  'inquiry_answered',
  'rent_unpaid',
  'message_new',
  /* tenant */
  'visit_scheduled',
  'ticket_closed',
  'renewal_question',
  'renewal_proposal',
  /* seeker */
  'inquiry_replied',
  'application_stage',
  'followed_dated',
]);

export const notificationSchema = z.object({
  /** Stable across reads, so the client can key and de-duplicate */
  id: z.string(),
  kind: notificationKindSchema,
  role: z.enum(['owner', 'tenant', 'seeker']),
  at: z.string(),
  propertyLabel: z.string(),
  /** Short, kind-specific detail — a ticket title, an applicant's name, a stage */
  detail: z.string().nullable(),
  /** A date the message is about (a visit, a free-date), when there is one */
  date: z.string().nullable(),
  /** Where tapping it goes, as an app route */
  href: z.string(),
  unread: z.boolean(),
});

export const notificationFeedSchema = z.object({
  items: z.array(notificationSchema),
  unread: z.number().int(),
});

export type NotificationKind = z.infer<typeof notificationKindSchema>;
export type NotificationView = z.infer<typeof notificationSchema>;
export type NotificationFeed = z.infer<typeof notificationFeedSchema>;
