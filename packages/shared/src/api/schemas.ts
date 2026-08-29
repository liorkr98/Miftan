import { z } from 'zod';

/**
 * One set of schemas, used twice: Fastify validates requests with them, and the
 * client derives its types from them. A field cannot drift between the two
 * because there is only one definition.
 */

/* Israeli mobile: 05X-XXXXXXX, with or without the dash. */
const israeliPhone = z
  .string()
  .trim()
  .regex(/^05\d-?\d{7}$/, 'expected an Israeli mobile number')
  .transform((v) => v.replace(/-/g, ''));

export const emailSchema = z.string().trim().toLowerCase().email().max(320);

/** Long enough to matter, no composition rules — those push people to Password1! */
export const passwordSchema = z
  .string()
  .min(10, 'at least 10 characters')
  .max(200);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: israeliPhone.optional(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  createdAt: z.string(),
});

/**
 * What a user *is* comes from what they hold, not a column.
 *
 * A landlord who also rents a flat and is queueing on a third gets all three,
 * and the app decides which shell to show from this rather than from a role
 * field that would have to be kept in sync.
 */
export const capabilitiesSchema = z.object({
  isOwner: z.boolean(),
  ownedPropertyCount: z.number().int(),
  isTenant: z.boolean(),
  /** Leases where this user is the tenant and the lease has not ended */
  activeLeaseIds: z.array(z.string()),
  isSeeker: z.boolean(),
  openLeadCount: z.number().int(),
});

export const meSchema = z.object({
  user: userSchema,
  capabilities: capabilitiesSchema,
});

export const authResultSchema = z.object({
  accessToken: z.string(),
  /** Seconds until the access token expires */
  expiresIn: z.number().int(),
  user: userSchema,
  capabilities: capabilitiesSchema,
});

export const okSchema = z.object({ ok: z.literal(true) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PublicUser = z.infer<typeof userSchema>;
export type Capabilities = z.infer<typeof capabilitiesSchema>;
export type Me = z.infer<typeof meSchema>;
export type AuthResult = z.infer<typeof authResultSchema>;
