import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  ApiError,
  changeEmailSchema,
  changePasswordSchema,
  dismissOnboardingSchema,
  meSchema,
  okSchema,
  renterProfileSchema,
  sessionListSchema,
  updateRenterProfileSchema,
  type Employment,
  type RenterProfileMissing,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { sendMail } from '../email/index.ts';
import { emailChangeMail, verifyMail } from '../email/templates.ts';
import { capabilitiesFor } from '../lib/capabilities.ts';
import {
  hashPassword,
  hashToken,
  revokeAllSessions,
  verifyPassword,
} from '../lib/auth.ts';
import { issueAuthToken, retireUnused } from '../lib/auth-tokens.ts';
import { env } from '../lib/env.ts';
import { REFRESH_COOKIE } from '../lib/http.ts';
import { requireUser } from '../plugins/authenticate.ts';
import { dismissedRoles, isDemoAccount, planOf, toPublicUser } from './auth.ts';

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
          plan: planOf(user),
          isDemo: isDemoAccount(user.id),
          onboardingDismissed: dismissedRoles(user.onboardingDismissed),
          emailVerified: user.emailVerifiedAt !== null,
        },
        capabilities: await capabilitiesFor(id),
      };
    },
  );

  /**
   * Closing a role's onboarding checklist. Stored on the account, not in the
   * browser, so it stays closed on the next phone too. Idempotent.
   */
  r.post(
    '/me/onboarding/dismiss',
    {
      onRequest: [app.authenticate],
      schema: { body: dismissOnboardingSchema, response: { 200: okSchema } },
    },
    async (request) => {
      const { id } = requireUser(request);
      const role = request.body.role;
      await db
        .update(s.users)
        .set({
          onboardingDismissed: sql`array(select distinct unnest(array_append(${s.users.onboardingDismissed}, ${role}::text)))`,
        })
        .where(eq(s.users.id, id));
      return { ok: true as const };
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

  r.post(
    '/me/verify-email',
    { onRequest: [app.authenticate], schema: { response: { 200: okSchema } } },
    async (request) => {
      const { id } = requireUser(request);
      const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
      if (user.emailVerifiedAt) return { ok: true as const };
      await retireUnused(id, 'verify');
      const token = await issueAuthToken(id, 'verify');
      await sendMail({
        to: user.email,
        ...verifyMail(`${env.WEB_ORIGIN.replace(/\/$/, '')}/verify/${token}`),
      });
      return { ok: true as const };
    },
  );

  r.post(
    '/me/password',
    { onRequest: [app.authenticate], schema: { body: changePasswordSchema, response: { 200: okSchema } } },
    async (request) => {
      const { id } = requireUser(request);
      const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
      if (!user.passwordHash || !(await verifyPassword(user.passwordHash, request.body.currentPassword))) {
        throw new ApiError('invalid_credentials', 'current password is wrong');
      }
      await db
        .update(s.users)
        .set({ passwordHash: await hashPassword(request.body.newPassword), updatedAt: new Date() })
        .where(eq(s.users.id, id));
      return { ok: true as const };
    },
  );

  r.post(
    '/me/email',
    { onRequest: [app.authenticate], schema: { body: changeEmailSchema, response: { 200: okSchema } } },
    async (request) => {
      const { id } = requireUser(request);
      const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
      if (!user.passwordHash || !(await verifyPassword(user.passwordHash, request.body.password))) {
        throw new ApiError('invalid_credentials', 'password is wrong');
      }
      const next = request.body.email;
      if (next === user.email) return { ok: true as const };
      const [taken] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, next));
      if (taken) throw new ApiError('email_taken', 'that email is already registered');
      await retireUnused(id, 'email_change');
      const token = await issueAuthToken(id, 'email_change', next);
      await sendMail({
        to: next,
        ...emailChangeMail(`${env.WEB_ORIGIN.replace(/\/$/, '')}/verify/${token}`),
      });
      return { ok: true as const };
    },
  );

  r.get(
    '/me/sessions',
    { onRequest: [app.authenticate], schema: { response: { 200: sessionListSchema } } },
    async (request) => {
      const { id } = requireUser(request);
      const presented = request.cookies[REFRESH_COOKIE];
      const currentHash = presented ? hashToken(presented) : null;
      const rows = await db
        .select()
        .from(s.sessions)
        .where(and(eq(s.sessions.userId, id), isNull(s.sessions.revokedAt)))
        .orderBy(desc(s.sessions.createdAt));
      return {
        sessions: rows.map((row) => ({
          id: row.id,
          userAgent: row.userAgent,
          ip: row.ip,
          createdAt: row.createdAt.toISOString(),
          current: currentHash !== null && row.tokenHash === currentHash,
        })),
      };
    },
  );

  r.post(
    '/me/sessions/revoke-all',
    { onRequest: [app.authenticate], schema: { response: { 200: okSchema } } },
    async (request) => {
      const { id } = requireUser(request);
      await revokeAllSessions(id);
      return { ok: true as const };
    },
  );

  r.get(
    '/me/export',
    { onRequest: [app.authenticate] },
    async (request) => {
      const { id } = requireUser(request);
      const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
      const properties = await db.select().from(s.properties).where(eq(s.properties.ownerId, id));
      const leases = await db.select().from(s.leases).where(eq(s.leases.tenantId, id));
      return {
        exportedAt: new Date().toISOString(),
        user: toPublicUser(user),
        properties: properties.map((p) => ({ id: p.id, street: p.street, city: p.city })),
        leases: leases.map((l) => ({ id: l.id, startDate: l.startDate, endDate: l.endDate })),
      };
    },
  );

  r.post(
    '/me/delete',
    { onRequest: [app.authenticate], schema: { body: changeEmailSchema.pick({ password: true }), response: { 200: okSchema } } },
    async (request) => {
      const { id } = requireUser(request);
      const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
      if (!user.passwordHash || !(await verifyPassword(user.passwordHash, request.body.password))) {
        throw new ApiError('invalid_credentials', 'password is wrong');
      }
      await db.update(s.users).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(s.users.id, id));
      await revokeAllSessions(id);
      return { ok: true as const };
    },
  );
}
