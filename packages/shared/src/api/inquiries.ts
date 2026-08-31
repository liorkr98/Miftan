import { z } from 'zod';
import { contactSchema } from './views';

/**
 * Availability inquiries — the chain this product exists for.
 *
 * A seeker asks about a flat whose tenant has not decided. The owner sees the
 * question, asks their tenant, the tenant answers, and the owner replies. Three
 * people, and the two ends never meet:
 *
 *   seeker → owner → tenant → owner → seeker
 *
 * The tenant's answer (`tenantAnswer`, `tenantAnswerNote`) is the private half.
 * A tenant saying "we're probably leaving, we haven't told our landlord we're
 * job-hunting" must never surface to a stranger. What crosses back to the
 * seeker is the owner's written reply and a date — nothing else. That is
 * enforced by these being three separate shapes, not one shape with a filter.
 */

export const inquiryStatusSchema = z.enum(['new', 'asked_tenant', 'answered', 'replied', 'declined']);
export const renewalIntentSchema = z.enum(['extend', 'leave', 'undecided', 'too_early']);

/** What the owner sees: everything, including the tenant's own words. */
export const ownerInquirySchema = z.object({
  scope: z.literal('owner'),
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  status: inquiryStatusSchema,
  message: z.string(),
  desiredMoveIn: z.string(),
  createdAt: z.string(),
  seeker: contactSchema,
  /** Null until there is a tenant to ask — a vacant unit has none. */
  tenant: contactSchema.nullable(),
  askedTenantAt: z.string().nullable(),
  /** Private. Owner-only, by construction. */
  tenantAnswer: renewalIntentSchema.nullable(),
  tenantAnswerNote: z.string().nullable(),
  tenantAnsweredAt: z.string().nullable(),
  ownerReply: z.string().nullable(),
  resultingAvailableFrom: z.string().nullable(),
});

/**
 * What the tenant sees: that they were asked, and by whom — their landlord.
 * The seeker does not appear. A tenant deciding whether to renew should not be
 * doing it while looking at the name of the person waiting for their flat.
 */
export const tenantInquirySchema = z.object({
  scope: z.literal('tenant'),
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  askedTenantAt: z.string().nullable(),
  answered: z.boolean(),
  myAnswer: renewalIntentSchema.nullable(),
  myNote: z.string().nullable(),
});

/** What the seeker sees: their own question, and the answer if one came. */
export const seekerInquirySchema = z.object({
  scope: z.literal('seeker'),
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  status: inquiryStatusSchema,
  message: z.string(),
  desiredMoveIn: z.string(),
  createdAt: z.string(),
  ownerReply: z.string().nullable(),
  resultingAvailableFrom: z.string().nullable(),
});

export const inquiryViewSchema = z.discriminatedUnion('scope', [
  ownerInquirySchema,
  tenantInquirySchema,
  seekerInquirySchema,
]);
export const inquiryListSchema = z.object({ inquiries: z.array(inquiryViewSchema) });

/* ── Writes ────────────────────────────────────────────── */

export const askInquirySchema = z.object({
  propertyId: z.string(),
  message: z.string().trim().min(1).max(600),
  desiredMoveIn: z.string(),
});

/** The owner forwarding the question to their tenant. Carries no seeker text. */
export const askTenantSchema = z.object({ note: z.string().trim().max(400).nullish() });

export const tenantAnswerSchema = z.object({
  answer: renewalIntentSchema,
  note: z.string().trim().max(400).nullish(),
});

/**
 * The owner's reply, and the only route by which a date becomes public. It is
 * the owner's own words — never a paste-through of what the tenant wrote.
 */
export const ownerReplySchema = z.object({
  reply: z.string().trim().min(1).max(600),
  availableFrom: z.string().nullish(),
  confidence: z.enum(['confirmed', 'likely', 'unknown']).default('likely'),
});

export type OwnerInquiry = z.infer<typeof ownerInquirySchema>;
export type TenantInquiry = z.infer<typeof tenantInquirySchema>;
export type SeekerInquiry = z.infer<typeof seekerInquirySchema>;
export type InquiryView = z.infer<typeof inquiryViewSchema>;
