import { z } from 'zod';

/**
 * The seeker's reusable renter profile.
 *
 * Filled once, reused across every application. `complete` is computed on
 * write from the fields a landlord actually screens on — not a checkbox the
 * seeker ticks. POST /leads refuses an incomplete profile, so the GET must
 * say what is still missing rather than only returning a boolean.
 *
 * Contact lives on `users`. Name and phone can be patched here because the
 * profile screen is where a seeker first writes them; email is identity and
 * is read-only.
 */

export const employmentSchema = z.enum([
  'salaried',
  'self_employed',
  'student',
  'retired',
  'between_jobs',
]);

export const renterProfileMissingSchema = z.enum([
  'name',
  'phone',
  'employment',
  'income',
  'occupants',
  'leaseLength',
]);

export const renterProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  incomeToRentRatio: z.number(),
  employment: employmentSchema.nullable(),
  hasGuarantors: z.boolean(),
  occupants: z.number().int(),
  pets: z.boolean(),
  smoker: z.boolean(),
  leaseLengthMonths: z.number().int(),
  priorLandlordReference: z.boolean(),
  about: z.string().nullable(),
  complete: z.boolean(),
  missing: z.array(renterProfileMissingSchema),
});

export const updateRenterProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).nullish(),
  incomeToRentRatio: z.number().min(0).max(20).optional(),
  employment: employmentSchema.optional(),
  hasGuarantors: z.boolean().optional(),
  occupants: z.number().int().min(1).max(20).optional(),
  pets: z.boolean().optional(),
  smoker: z.boolean().optional(),
  leaseLengthMonths: z.number().int().min(1).max(60).optional(),
  priorLandlordReference: z.boolean().optional(),
  about: z.string().trim().max(2000).nullish(),
});

export type RenterProfileView = z.infer<typeof renterProfileSchema>;
export type Employment = z.infer<typeof employmentSchema>;
export type RenterProfileMissing = z.infer<typeof renterProfileMissingSchema>;
