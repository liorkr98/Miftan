import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import {
  meSchema,
  renterProfileSchema,
  updateRenterProfileSchema,
  type Employment,
  type RenterProfileMissing,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { capabilitiesFor } from '../lib/capabilities.ts';
import { requireUser } from '../plugins/authenticate.ts';

type ProfileRow = typeof s.renterProfiles.$inferSelect;
type UserRow = typeof s.users.$inferSelect;

const EMPLOYMENT: readonly Employment[] = [
  'salaried',
  'self_employed',
  'student',
  'retired',
  'between_jobs',
];

function isEmployment(value: string): value is Employment {
  return (EMPLOYMENT as readonly string[]).includes(value);
}

function projectProfile(user: UserRow, row: ProfileRow | undefined) {
  const employmentRaw = row?.employment ?? '';
  const employment = isEmployment(employmentRaw) ? employmentRaw : null;

  const incomeToRentRatio = row ? Number(row.incomeToRentRatio) : 0;
  const occupants = row?.occupants ?? 1;
  const leaseLengthMonths = row?.leaseLengthMonths ?? 12;
  const phone = user.phone?.trim() ? user.phone : null;

  const missing: RenterProfileMissing[] = [];
  if (user.name.trim().length < 2) missing.push('name');
  if (!phone) missing.push('phone');
  if (!employment) missing.push('employment');
  if (!(incomeToRentRatio > 0)) missing.push('income');
  /* Occupants and lease length have defaults that would pass, but a profile
     that was never saved is not complete — those defaults are not answers. */
  if (!row || occupants < 1) missing.push('occupants');
  if (!row || leaseLengthMonths < 1) missing.push('leaseLength');

  const complete = missing.length === 0;

  return {
    name: user.name,
    email: user.email,
    phone,
    incomeToRentRatio,
    employment,
    hasGuarantors: row?.hasGuarantors ?? false,
    occupants,
    pets: row?.pets ?? false,
    smoker: row?.smoker ?? false,
    leaseLengthMonths,
    priorLandlordReference: row?.priorLandlordReference ?? false,
    about: row?.about ?? null,
    complete,
    missing,
  };
}

export async function meRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/me',
    { onRequest: [app.authenticate], schema: { response: { 200: meSchema } } },
    async (request) => {
      const { id } = requireUser(request);
      const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          createdAt: user.createdAt.toISOString(),
        },
        capabilities: await capabilitiesFor(id),
      };
    },
  );

  /**
   * The seeker's reusable profile. GET never 404s: an account that has not
   * filled it in yet still needs the form, and inventing a row on read would
   * mark defaults as answers they did not give.
   */
  r.get(
    '/me/renter-profile',
    { onRequest: [app.authenticate], schema: { response: { 200: renterProfileSchema } } },
    async (request) => {
      const { id } = requireUser(request);
      const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
      const [row] = await db.select().from(s.renterProfiles).where(eq(s.renterProfiles.userId, id));
      return projectProfile(user, row);
    },
  );

  r.patch(
    '/me/renter-profile',
    {
      onRequest: [app.authenticate],
      schema: { body: updateRenterProfileSchema, response: { 200: renterProfileSchema } },
    },
    async (request) => {
      const { id } = requireUser(request);
      const b = request.body;

      if (b.name !== undefined || b.phone !== undefined) {
        await db
          .update(s.users)
          .set({
            ...(b.name !== undefined ? { name: b.name } : {}),
            ...(b.phone !== undefined ? { phone: b.phone === '' || b.phone === null ? null : b.phone } : {}),
            updatedAt: new Date(),
          })
          .where(eq(s.users.id, id));
      }

      const [existing] = await db.select().from(s.renterProfiles).where(eq(s.renterProfiles.userId, id));

      const next = {
        incomeToRentRatio: String(
          b.incomeToRentRatio ?? (existing ? Number(existing.incomeToRentRatio) : 0),
        ),
        employment: b.employment ?? existing?.employment ?? '',
        hasGuarantors: b.hasGuarantors ?? existing?.hasGuarantors ?? false,
        occupants: b.occupants ?? existing?.occupants ?? 1,
        pets: b.pets ?? existing?.pets ?? false,
        smoker: b.smoker ?? existing?.smoker ?? false,
        leaseLengthMonths: b.leaseLengthMonths ?? existing?.leaseLengthMonths ?? 12,
        priorLandlordReference: b.priorLandlordReference ?? existing?.priorLandlordReference ?? false,
        about: b.about === undefined ? (existing?.about ?? null) : b.about,
      };

      const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
      const draft = projectProfile(user, { userId: id, ...next, complete: false, updatedAt: new Date() });
      const complete = draft.missing.length === 0;

      await db
        .insert(s.renterProfiles)
        .values({ userId: id, ...next, complete })
        .onConflictDoUpdate({
          target: s.renterProfiles.userId,
          set: { ...next, complete, updatedAt: new Date() },
        });

      const [row] = await db.select().from(s.renterProfiles).where(eq(s.renterProfiles.userId, id));
      return projectProfile(user, row);
    },
  );
}
