import { z } from 'zod';
import { amenitySchema } from './search';

/**
 * Creating and updating a unit.
 *
 * Shekels in, agorot stored — a first-property form is exactly where a units
 * mistake becomes an expensive one. Lat/lng are optional: if omitted, the
 * city's catalogue centre is used so a landlord can onboard without a map pin.
 */

const unitStatusSchema = z.enum(['occupied', 'vacant', 'vacating', 'renovating']);
const availabilityConfidenceSchema = z.enum(['confirmed', 'likely', 'unknown']);

export const createPropertySchema = z.object({
  street: z.string().trim().min(1).max(120),
  houseNumber: z.string().trim().min(1).max(20),
  city: z.string().trim().min(1).max(80),
  neighborhood: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  rooms: z.number().min(1).max(12),
  sqm: z.number().int().min(10).max(600),
  floor: z.number().int().min(-2).max(80),
  totalFloors: z.number().int().min(1).max(80),
  amenities: z.array(amenitySchema).max(20).default([]),
  monthlyRentShekels: z.number().int().min(0).max(200_000),
  arnonaBimonthlyShekels: z.number().int().min(0).max(50_000).optional(),
  vaadMonthlyShekels: z.number().int().min(0).max(20_000).optional(),
  status: unitStatusSchema.default('vacant'),
  listed: z.boolean().default(false),
  notes: z.string().trim().max(4000).nullish(),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  availabilityConfidence: availabilityConfidenceSchema.optional(),
});

export const updatePropertySchema = z.object({
  street: z.string().trim().min(1).max(120).optional(),
  houseNumber: z.string().trim().min(1).max(20).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  neighborhood: z.string().trim().min(1).max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  rooms: z.number().min(1).max(12).optional(),
  sqm: z.number().int().min(10).max(600).optional(),
  floor: z.number().int().min(-2).max(80).optional(),
  totalFloors: z.number().int().min(1).max(80).optional(),
  amenities: z.array(amenitySchema).max(20).optional(),
  monthlyRentShekels: z.number().int().min(0).max(200_000).optional(),
  arnonaBimonthlyShekels: z.number().int().min(0).max(50_000).optional(),
  vaadMonthlyShekels: z.number().int().min(0).max(20_000).optional(),
  status: unitStatusSchema.optional(),
  listed: z.boolean().optional(),
  notes: z.string().trim().max(4000).nullish(),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  availabilityConfidence: availabilityConfidenceSchema.optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
