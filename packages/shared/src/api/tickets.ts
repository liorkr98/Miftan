import { z } from 'zod';
import { contactSchema } from './views';

/**
 * Ticket views.
 *
 * Unlike properties there is no public shape — a maintenance ticket is never
 * visible to a stranger. The two scopes differ only slightly, but they are
 * still separate shapes for the same reason as everywhere else: what a tenant
 * cannot see should not be a field somebody remembers to remove.
 */

export const ticketStatusSchema = z.enum([
  'new', 'approved', 'assigned', 'in_progress', 'awaiting_receipt', 'closed',
]);
export const ticketCategorySchema = z.enum([
  'ac', 'plumbing', 'electrical', 'leak', 'boiler', 'appliance', 'lock', 'paint', 'other',
]);
export const severitySchema = z.enum(['low', 'medium', 'urgent']);
export const ticketActionSchema = z.enum([
  'approve', 'reject', 'assign', 'start', 'request_receipt', 'close', 'reopen',
]);

export const ticketMessageSchema = z.object({
  id: z.string(),
  authorRole: z.enum(['owner', 'tenant', 'vendor', 'lead']),
  authorName: z.string(),
  body: z.string(),
  photos: z.array(z.string()),
  at: z.string(),
});

export const ticketReceiptSchema = z.object({
  amountAgorot: z.number().int(),
  file: z.string().nullable(),
  uploadedAt: z.string(),
  uploadedBy: z.enum(['owner', 'tenant', 'vendor', 'lead']),
});

/** The tradesperson as the tenant sees them: who is coming, and when. */
export const assignedVendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  trade: z.string(),
  phone: z.string(),
});

const ticketBase = z.object({
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  category: ticketCategorySchema,
  severity: severitySchema,
  status: ticketStatusSchema,
  title: z.string(),
  description: z.string(),
  photos: z.array(z.string()),
  createdAt: z.string(),
  scheduledAt: z.string().nullable(),
  tenantAvailability: z.array(z.string()),
  tenantConfirmedSlot: z.boolean(),
  vendor: assignedVendorSchema.nullable(),
  receipt: ticketReceiptSchema.nullable(),
  messages: z.array(ticketMessageSchema),
  /** What this viewer may legally do next, from the server's own table */
  availableActions: z.array(ticketActionSchema),
});

export const tenantTicketSchema = ticketBase.extend({ scope: z.literal('tenant') });

export const ownerTicketSchema = ticketBase.extend({
  scope: z.literal('owner'),
  reportedBy: contactSchema.nullable(),
  /** What the platform's network charges — commercial, so owner-only */
  vendorCalloutFeeAgorot: z.number().int().nullable(),
  expenseId: z.string().nullable(),
});

export const ticketViewSchema = z.discriminatedUnion('scope', [
  tenantTicketSchema,
  ownerTicketSchema,
]);
export const ticketListSchema = z.object({ tickets: z.array(ticketViewSchema) });

/* ── Inputs ────────────────────────────────────────────── */

export const createTicketSchema = z.object({
  propertyId: z.string(),
  category: ticketCategorySchema,
  severity: severitySchema,
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).default(''),
  photos: z.array(z.string().url()).max(10).default([]),
  /** Windows the tenant can be home, as ISO datetimes */
  availability: z.array(z.string().datetime()).max(10).default([]),
});

export const assignVendorSchema = z.object({
  vendorId: z.string(),
  scheduledAt: z.string().datetime(),
});

export const uploadReceiptSchema = z.object({
  amountAgorot: z.number().int().positive().max(100_000_000),
  file: z.string().url().nullable().default(null),
});

export const postMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  photos: z.array(z.string().url()).max(10).default([]),
});

export type TicketView = z.infer<typeof ticketViewSchema>;
export type OwnerTicket = z.infer<typeof ownerTicketSchema>;
export type TenantTicket = z.infer<typeof tenantTicketSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
