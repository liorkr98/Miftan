import { z } from 'zod';

/**
 * Message threads.
 *
 * A thread always has an owner on one side, because every conversation this
 * product hosts is with a landlord: their tenant, a tradesperson, an applicant.
 * The counterparty may or may not have an account — a plumber usually does not
 * — which is why `counterpartyName` is stored rather than only a user id.
 */

export const actorRoleSchema = z.enum(['owner', 'tenant', 'vendor', 'lead']);

export const threadMessageSchema = z.object({
  id: z.string(),
  authorRole: actorRoleSchema,
  authorName: z.string(),
  body: z.string(),
  read: z.boolean(),
  at: z.string(),
  /** True when you wrote it — the only thing the UI needs to pick a side */
  mine: z.boolean(),
});

export const threadSchema = z.object({
  id: z.string(),
  subject: z.string(),
  /** The other person, from the reader's point of view */
  counterpartyName: z.string(),
  counterpartyRole: actorRoleSchema,
  propertyId: z.string().nullable(),
  propertyLabel: z.string().nullable(),
  ticketId: z.string().nullable(),
  leadId: z.string().nullable(),
  updatedAt: z.string(),
  unread: z.number().int(),
  lastMessage: z.string().nullable(),
  messages: z.array(threadMessageSchema),
});

export const threadListSchema = z.object({
  threads: z.array(threadSchema.omit({ messages: true })),
  totalUnread: z.number().int(),
});

export const startThreadSchema = z.object({
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  counterpartyRole: actorRoleSchema,
  counterpartyUserId: z.string().nullish(),
  /** Required when there is no account to name them by */
  counterpartyName: z.string().trim().min(1).max(120).nullish(),
  propertyId: z.string().nullish(),
  ticketId: z.string().nullish(),
  leadId: z.string().nullish(),
});

/* `postMessageSchema` is already taken by the ticket thread, which is a
   different conversation with different rules. Named apart rather than merged. */
export const postThreadMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export type ThreadView = z.infer<typeof threadSchema>;
