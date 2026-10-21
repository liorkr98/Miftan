import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNull } from 'drizzle-orm';
import {
  ApiError,
  authResultSchema,
  forgotPasswordSchema,
  loginSchema,
  meSchema,
  okSchema,
  registerSchema,
  resetPasswordSchema,
  supabaseClaimSchema,
  verifyTokenSchema,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { env, isProd } from '../lib/env.ts';
import { newId } from '../lib/ids.ts';
import {
  ACCESS_TTL_SECONDS,
  createSession,
  hashPassword,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  signAccessToken,
  verifyPassword,
  supabaseEmailConfirmed,
  verifySupabaseToken,
  wasteTimeLikeAVerify,
} from '../lib/auth.ts';
import { consumeAuthToken, issueAuthToken, retireUnused } from '../lib/auth-tokens.ts';
import { capabilitiesFor } from '../lib/capabilities.ts';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  clientMeta,
  readRefreshCookie,
  setRefreshCookie,
} from '../lib/http.ts';
import { authBurst, refreshBurst } from '../lib/rate-limit.ts';
import { sendMail } from '../email/index.ts';
import { alreadyRegisteredMail, resetMail, verifyMail } from '../email/templates.ts';

const publicUser = (u: typeof s.users.$inferSelect) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  createdAt: u.createdAt.toISOString(),
  plan: planOf(u),
  isDemo: isDemoAccount(u.id),
  onboardingDismissed: dismissedRoles(u.onboardingDismissed),
  emailVerified: u.emailVerifiedAt !== null,
});

export function toPublicUser(u: typeof s.users.$inferSelect) {
  return publicUser(u);
}

/**
 * Fails closed: only an exact 'pro' is paid. A typo, a null, a value from a
 * future plan this build does not know — all read as free.
 * HUMAN REVIEW: this decides what an account can open.
 */
export function planOf(u: { plan: string | null }): 'free' | 'pro' {
  return u.plan === 'pro' ? 'pro' : 'free';
}

/** Only the three known role names survive the trip out. */
export function dismissedRoles(raw: string[] | null): Array<'owner' | 'tenant' | 'seeker'> {
  return (raw ?? []).filter((r): r is 'owner' | 'tenant' | 'seeker' =>
    r === 'owner' || r === 'tenant' || r === 'seeker',
  );
}

/**
 * Seeded accounts have ids from seedId(): usr_seed_…
 * On a production process that is not the demo, that prefix means nothing —
 * a copied id must not unlock demo-only UI for a real landlord.
 */
export function accountIsDemo(id: string, production: boolean, demoMode: boolean): boolean {
  if (production && !demoMode) return false;
  return id.startsWith('usr_seed_');
}

export function isDemoAccount(id: string): boolean {
  return accountIsDemo(id, isProd, env.DEMO_MODE === 'true');
}

function webUrl(path: string): string {
  return `${env.WEB_ORIGIN.replace(/\/$/, '')}${path}`;
}

export async function authRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/auth/register',
    { onRequest: [authBurst], schema: { body: registerSchema, response: { 201: okSchema } } },
    async (request, reply) => {
      const { name, email, phone, password } = request.body;

      const [taken] = await db.select().from(s.users).where(eq(s.users.email, email));
      if (taken) {
        await wasteTimeLikeAVerify();
        if (!taken.deletedAt) {
          await sendMail({ to: email, ...alreadyRegisteredMail(webUrl('/sign-in')) });
        }
        return reply.code(201).send({ ok: true as const });
      }

      const [user] = await db
        .insert(s.users)
        .values({
          id: newId('user'),
          name,
          email,
          phone: phone ?? null,
          passwordHash: await hashPassword(password),
          termsAcceptedAt: new Date(),
        })
        .returning();

      const token = await issueAuthToken(user.id, 'verify');
      await sendMail({ to: email, ...verifyMail(webUrl(`/verify/${token}`)) });

      return reply.code(201).send({ ok: true as const });
    },
  );

  r.post(
    '/auth/login',
    { onRequest: [authBurst], schema: { body: loginSchema, response: { 200: authResultSchema } } },
    async (request, reply) => {
      const { email, password } = request.body;

      const [user] = await db
        .select()
        .from(s.users)
        .where(and(eq(s.users.email, email), isNull(s.users.deletedAt)));

      if (!user?.passwordHash) {
        await wasteTimeLikeAVerify();
        throw new ApiError('invalid_credentials', 'email or password is wrong');
      }
      if (!(await verifyPassword(user.passwordHash, password))) {
        throw new ApiError('invalid_credentials', 'email or password is wrong');
      }

      const session = await createSession(user.id, clientMeta(request));
      setRefreshCookie(reply, session.token, session.expiresAt);

      return {
        accessToken: await signAccessToken(user.id),
        expiresIn: ACCESS_TTL_SECONDS,
        user: publicUser(user),
        capabilities: await capabilitiesFor(user.id),
      };
    },
  );

  r.post(
    '/auth/forgot',
    { onRequest: [authBurst], schema: { body: forgotPasswordSchema, response: { 200: okSchema } } },
    async (request) => {
      const { email } = request.body;
      const [user] = await db
        .select()
        .from(s.users)
        .where(and(eq(s.users.email, email), isNull(s.users.deletedAt)));

      if (user) {
        await retireUnused(user.id, 'reset');
        const token = await issueAuthToken(user.id, 'reset');
        await sendMail({ to: email, ...resetMail(webUrl(`/reset/${token}`)) });
      } else {
        await wasteTimeLikeAVerify();
      }
      return { ok: true as const };
    },
  );

  r.post(
    '/auth/reset',
    { onRequest: [authBurst], schema: { body: resetPasswordSchema, response: { 200: okSchema } } },
    async (request) => {
      const { token, password } = request.body;
      const row = await consumeAuthToken(token, 'reset');
      await db
        .update(s.users)
        .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
        .where(eq(s.users.id, row.userId));
      await revokeAllSessions(row.userId);
      return { ok: true as const };
    },
  );

  r.post(
    '/auth/verify',
    { onRequest: [authBurst], schema: { body: verifyTokenSchema, response: { 200: authResultSchema } } },
    async (request, reply) => {
      const presented = request.body.token;
      /* Try verify first, then email_change — the hash is unique so only one matches. */
      let row;
      try {
        row = await consumeAuthToken(presented, 'verify');
      } catch {
        row = await consumeAuthToken(presented, 'email_change');
      }

      const [user] = await db.select().from(s.users).where(eq(s.users.id, row.userId));
      if (!user || user.deletedAt) throw new ApiError('not_authenticated', 'user no longer exists');

      if (row.purpose === 'email_change' && row.payload) {
        await db
          .update(s.users)
          .set({ email: row.payload, emailVerifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(s.users.id, user.id));
        await revokeAllSessions(user.id);
      } else {
        await db
          .update(s.users)
          .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(s.users.id, user.id));
      }

      const [fresh] = await db.select().from(s.users).where(eq(s.users.id, user.id));
      const session = await createSession(fresh.id, clientMeta(request));
      setRefreshCookie(reply, session.token, session.expiresAt);

      return {
        accessToken: await signAccessToken(fresh.id),
        expiresIn: ACCESS_TTL_SECONDS,
        user: publicUser(fresh),
        capabilities: await capabilitiesFor(fresh.id),
      };
    },
  );

  r.post(
    '/auth/refresh',
    { onRequest: [refreshBurst], schema: { response: { 200: authResultSchema } } },
    async (request, reply) => {
      const presented = readRefreshCookie(request);

      let rotated;
      try {
        rotated = await rotateSession(presented, clientMeta(request));
      } catch (err) {
        clearRefreshCookie(reply);
        throw err;
      }

      setRefreshCookie(reply, rotated.session.token, rotated.session.expiresAt);

      const [user] = await db.select().from(s.users).where(eq(s.users.id, rotated.userId));
      if (!user || user.deletedAt) {
        clearRefreshCookie(reply);
        throw new ApiError('not_authenticated', 'user no longer exists');
      }

      return {
        accessToken: await signAccessToken(user.id),
        expiresIn: ACCESS_TTL_SECONDS,
        user: publicUser(user),
        capabilities: await capabilitiesFor(user.id),
      };
    },
  );

  /**
   * Give a Supabase Auth account its row here.
   *
   * Supabase owns the password; this owns the portfolio. Signing in through
   * Supabase proves who someone is but says nothing about the leases, tickets
   * and tenants attached to them, so the two have to be joined once. The
   * Supabase access token is the whole input — the body carries only what
   * Supabase does not ask for at sign-up.
   *
   * Idempotent: called again with the same token it simply returns the row.
   *
   * HUMAN REVIEW: this decides which existing account a new Supabase login is
   * allowed to become.
   */
  r.post(
    '/auth/supabase',
    {
      onRequest: [authBurst],
      schema: { body: supabaseClaimSchema, response: { 200: meSchema } },
    },
    async (request) => {
      const header = request.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new ApiError('not_authenticated', 'missing supabase token');
      }
      const token = header.slice(7);
      const identity = await verifySupabaseToken(token);

      /* Already claimed. */
      const [linked] = await db
        .select()
        .from(s.users)
        .where(and(eq(s.users.supabaseUserId, identity.sub), isNull(s.users.deletedAt)));
      if (linked) {
        return { user: publicUser(linked), capabilities: await capabilitiesFor(linked.id) };
      }

      if (!identity.email) {
        throw new ApiError('validation_failed', 'supabase token carries no email');
      }

      /* No deletedAt filter here, deliberately: users_email_key is unique on
         the address alone, so a closed account still holds it. Filtering
         deleted rows out would find nothing and then fail on the insert. The
         register route reads it the same way. */
      const [existing] = await db
        .select()
        .from(s.users)
        .where(eq(s.users.email, identity.email));

      if (existing?.deletedAt) {
        /* Closing an account was deliberate; signing up again elsewhere is not
           consent to have the old portfolio handed back. The address stays
           spent. */
        throw new ApiError('forbidden', 'this address belongs to a closed account');
      }

      if (existing) {
        /* Adopting an account that already holds data. Without the verified
           check, anyone could sign up at Supabase using a landlord's address
           and inherit their portfolio — the password here would never be
           tested, because Supabase is the thing being trusted. A confirmed
           address is the only evidence that the person holds the mailbox. */
        if (!(await supabaseEmailConfirmed(token))) {
          throw new ApiError('forbidden', 'confirm your email address before signing in this way');
        }
        /* Another Supabase account got here first. Reassigning would hand one
           person's data to another, so it stops. */
        if (existing.supabaseUserId && existing.supabaseUserId !== identity.sub) {
          throw new ApiError('forbidden', 'this account is already linked to another login');
        }

        const [updated] = await db
          .update(s.users)
          .set({ supabaseUserId: identity.sub, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() })
          .where(eq(s.users.id, existing.id))
          .returning();
        return { user: publicUser(updated), capabilities: await capabilitiesFor(updated.id) };
      }

      /* New to us. No password hash: Supabase holds it. */
      const [created] = await db
        .insert(s.users)
        .values({
          id: newId('user'),
          name: request.body.name,
          email: identity.email,
          phone: request.body.phone ?? null,
          supabaseUserId: identity.sub,
          termsAcceptedAt: new Date(),
          emailVerifiedAt: (await supabaseEmailConfirmed(token)) ? new Date() : null,
        })
        .returning();

      return { user: publicUser(created), capabilities: await capabilitiesFor(created.id) };
    },
  );

  r.post('/auth/logout', { schema: { response: { 200: okSchema } } }, async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (token) await revokeSession(token);
    clearRefreshCookie(reply);
    return { ok: true as const };
  });
}
