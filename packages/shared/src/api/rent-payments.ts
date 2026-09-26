import { z } from 'zod';
import { contactSchema } from './views';

/**
 * Rent payments.
 *
 * Two shapes, for the same reason as everywhere else: a tenant looking at their
 * own history has no business seeing another tenant's name, and an owner looking
 * at a roll needs exactly that. Money is agorot. `month` is `yyyy-MM`.
 */

export const paymentMethodSchema = z.enum([
  'bank_transfer',
  'standing_order',
  'post_dated_checks',
]);

const rentPaymentBase = z.object({
  id: z.string(),
  propertyId: z.string(),
  propertyLabel: z.string(),
  leaseId: z.string(),
  month: z.string(),
  dueAgorot: z.number().int(),
  paidAgorot: z.number().int(),
  paidAt: z.string().nullable(),
  method: paymentMethodSchema,
});

export const ownerRentPaymentSchema = rentPaymentBase.extend({
  scope: z.literal('owner'),
  tenant: contactSchema.nullable(),
});

export const tenantRentPaymentSchema = rentPaymentBase.extend({
  scope: z.literal('tenant'),
});

export const rentPaymentViewSchema = z.discriminatedUnion('scope', [
  ownerRentPaymentSchema,
  tenantRentPaymentSchema,
]);

export const rentPaymentQuerySchema = z.object({
  propertyId: z.string().optional(),
  /** Inclusive, yyyy-MM */
  from: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  /** Inclusive, yyyy-MM */
  to: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export const rentPaymentListSchema = z.object({
  payments: z.array(rentPaymentViewSchema),
});

export type RentPaymentView = z.infer<typeof rentPaymentViewSchema>;
export type OwnerRentPayment = z.infer<typeof ownerRentPaymentSchema>;
export type TenantRentPayment = z.infer<typeof tenantRentPaymentSchema>;
