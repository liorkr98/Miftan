import { z } from 'zod';
import { paymentMethodSchema } from './rent-payments';

/**
 * Tenant invites — the only way an account becomes a tenant.
 *
 * The owner fixes the lease terms when making the invite, so accepting it is
 * agreement to terms, not a chance to write them. The link carries a secret
 * token; only its hash is stored, and the link is shown to the owner once.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected yyyy-MM-dd');

export const createInviteSchema = z
  .object({
    startDate: day,
    endDate: day,
    monthlyRentShekels: z.number().int().min(1).max(200_000),
    depositShekels: z.number().int().min(0).max(1_000_000).default(0),
    paymentMethod: paymentMethodSchema,
    /** For the owner's own list only — never shown to anyone else */
    tenantName: z.string().trim().max(120).nullish(),
  })
  .refine((b) => b.endDate > b.startDate, { message: 'endDate must be after startDate', path: ['endDate'] });

export const inviteStatusSchema = z.enum(['open', 'accepted', 'revoked', 'expired']);

/** The owner's view of an invite. No token: it was shown once, at creation. */
export const ownerInviteSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  status: inviteStatusSchema,
  startDate: z.string(),
  endDate: z.string(),
  monthlyRentAgorot: z.number().int(),
  depositAgorot: z.number().int(),
  paymentMethod: paymentMethodSchema,
  tenantName: z.string().nullable(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const createdInviteSchema = z.object({
  invite: ownerInviteSchema,
  /** The secret. Returned exactly once; the server keeps only its hash. */
  token: z.string(),
});

export const inviteListSchema = z.object({ invites: z.array(ownerInviteSchema) });

/**
 * What the person holding the link may see before accepting: the flat, the
 * terms, and the owner's first name. Not the owner's contact details, not
 * other tenants, not the unit's history.
 */
export const invitePreviewSchema = z.object({
  status: inviteStatusSchema,
  propertyLabel: z.string(),
  city: z.string(),
  ownerFirstName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  monthlyRentAgorot: z.number().int(),
  depositAgorot: z.number().int(),
  paymentMethod: paymentMethodSchema,
  expiresAt: z.string(),
});

/**
 * Recording a tenancy the owner already has, without inviting anyone.
 *
 * Most landlords arrive with tenants in place, many of whom will never open
 * an app. The lease still needs to exist for rent, tickets and documents to
 * work. The tenant can be invited later; accepting then takes over this lease.
 */
export const recordLeaseSchema = z
  .object({
    startDate: day,
    endDate: day,
    monthlyRentShekels: z.number().int().min(1).max(200_000),
    depositShekels: z.number().int().min(0).max(1_000_000).default(0),
    paymentMethod: paymentMethodSchema,
    tenantName: z.string().trim().min(1).max(120),
    tenantPhone: z
      .string()
      .trim()
      .regex(/^05\d-?\d{7}$/, 'expected an Israeli mobile number')
      .transform((v) => v.replace(/-/g, ''))
      .nullish(),
    noticePeriodDays: z.number().int().min(0).max(365).optional(),
    hasExtensionOption: z.boolean().optional(),
    extensionMonths: z.number().int().min(1).max(60).nullish(),
  })
  .refine((b) => b.endDate > b.startDate, { message: 'endDate must be after startDate', path: ['endDate'] });

export const recordedLeaseSchema = z.object({ leaseId: z.string() });

export const acceptedInviteSchema = z.object({ propertyId: z.string(), leaseId: z.string() });

export type RecordLeaseInput = z.input<typeof recordLeaseSchema>;
export type CreateInviteInput = z.input<typeof createInviteSchema>;
export type OwnerInvite = z.infer<typeof ownerInviteSchema>;
export type CreatedInvite = z.infer<typeof createdInviteSchema>;
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
