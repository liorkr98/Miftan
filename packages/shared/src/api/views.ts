import { z } from 'zod';

/**
 * Per-scope views of a property.
 *
 * These are three different shapes, not one shape with fields blanked out. A
 * seeker's view has no `tenant` key at all, so leaking a tenant's name is a
 * type error rather than a filter somebody forgot to apply. That is the whole
 * design: make the boundary structural instead of a rule people have to
 * remember on every new endpoint.
 *
 * Money is agorot throughout, as everywhere else on the wire.
 */

export const addressSchema = z.object({
  street: z.string(),
  number: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export const availabilitySignalSchema = z.object({
  kind: z.enum(['now', 'dated', 'extending', 'unknown']),
  date: z.string().nullable(),
  confidence: z.enum(['confirmed', 'likely', 'unknown']),
  /** True when asking the owner would plausibly produce a date */
  askable: z.boolean(),
});

/** What a stranger or a seeker may see. Note what is absent. */
export const publicPropertySchema = z.object({
  id: z.string(),
  address: addressSchema,
  rooms: z.number(),
  sqm: z.number().int(),
  floor: z.number().int(),
  totalFloors: z.number().int(),
  amenities: z.array(z.string()),
  photos: z.array(z.string()),
  monthlyRentAgorot: z.number().int(),
  arnonaBimonthlyAgorot: z.number().int(),
  vaadMonthlyAgorot: z.number().int(),
  availability: availabilitySignalSchema,
  /** Aggregate only — never who is queueing */
  queueCount: z.number().int(),
});

export const leaseTermsSchema = z.object({
  id: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  monthlyRentAgorot: z.number().int(),
  depositAgorot: z.number().int(),
  paymentMethod: z.enum(['bank_transfer', 'standing_order', 'post_dated_checks']),
  hasExtensionOption: z.boolean(),
  extensionMonths: z.number().int().nullable(),
  noticePeriodDays: z.number().int(),
  renewalIntent: z.enum(['extend', 'leave', 'undecided', 'too_early']).nullable(),
  renewalAskedAt: z.string().nullable(),
});

export const contactSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
});

/** The tenant's own unit: the public view plus their lease and their landlord. */
export const tenantPropertySchema = publicPropertySchema.extend({
  scope: z.literal('tenant'),
  lease: leaseTermsSchema,
  owner: contactSchema,
});

/** The owner's own unit: everything, including who lives there. */
export const ownerPropertySchema = publicPropertySchema.extend({
  scope: z.literal('owner'),
  status: z.enum(['occupied', 'vacant', 'vacating', 'renovating']),
  listed: z.boolean(),
  notes: z.string().nullable(),
  lease: leaseTermsSchema.nullable(),
  tenant: contactSchema.nullable(),
  openTicketCount: z.number().int(),
});

export const publicPropertyViewSchema = publicPropertySchema.extend({
  scope: z.literal('public'),
});

export const propertyViewSchema = z.discriminatedUnion('scope', [
  publicPropertyViewSchema,
  tenantPropertySchema,
  ownerPropertySchema,
]);

export const propertyListSchema = z.object({
  properties: z.array(propertyViewSchema),
});

/** The wire shape. `Address` in ./types is the domain one. */
export type AddressView = z.infer<typeof addressSchema>;
export type AvailabilitySignalView = z.infer<typeof availabilitySignalSchema>;
export type PublicProperty = z.infer<typeof publicPropertyViewSchema>;
export type TenantProperty = z.infer<typeof tenantPropertySchema>;
export type OwnerProperty = z.infer<typeof ownerPropertySchema>;
export type PropertyView = z.infer<typeof propertyViewSchema>;
