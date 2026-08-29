import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNull } from 'drizzle-orm';
import {
  ApiError,
  authResultSchema,
  loginSchema,
  okSchema,
  registerSchema,
} from '@miftach/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import {
  ACCESS_TTL_SECONDS,
  createSession,
  hashPassword,
  revokeSession,
  rotateSession,
  signAccessToken,
  verifyPassword,
  wasteTimeLikeAVerify,
} from '../lib/auth.ts';
import { capabilitiesFor } from '../lib/capabilities.ts';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  clientMeta,
  readRefreshCookie,
  setRefreshCookie,
} from '../lib/http.ts';

const publicUser = (u: typeof s.users.$inferSelect) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  createdAt: u.createdAt.toISOString(),
});

export async function authRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/auth/register',
    { schema: { body: registerSchema, response: { 201: authResultSchema } } },
    async (request, reply) => {
      const { name, email, phone, password } = request.body;

      const [taken] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
      if (taken) throw new ApiError('email_taken', 'that email is already registered');

      const [user] = await db
        .insert(s.users)
        .values({
          id: newId('user'),
          name,
          email,
          phone: phone ?? null,
          passwordHash: await hashPassword(password),
        })
        .returning();

      const session = await createSession(user.id, clientMeta(request));
      setRefreshCookie(reply, session.token, session.expiresAt);

      return reply.code(201).send({
        accessToken: await signAccessToken(user.id),
        expiresIn: ACCESS_TTL_SECONDS,
        user: publicUser(user),
        capabilities: await capabilitiesFor(user.id),
      });
    },
  );

  r.post(
    '/auth/login',
    { schema: { body: loginSchema, response: { 200: authResultSchema } } },
    async (request, reply) => {
      const { email, password } = request.body;

      const [user] = await db
        .select()
        .from(s.users)
        .where(and(eq(s.users.email, email), isNull(s.users.deletedAt)));

      /* Same error and roughly the same timing whether the account is missing
         or the password is wrong, so this endpoint cannot be used to find out
         which emails are registered. */
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
    '/auth/refresh',
    { schema: { response: { 200: authResultSchema } } },
    async (request, reply) => {
      const presented = readRefreshCookie(request);

      let rotated;
      try {
        rotated = await rotateSession(presented, clientMeta(request));
      } catch (err) {
        /* Any failure here means the cookie is worthless — drop it so the
           browser stops sending it and the client can route to login. */
        clearRefreshCookie(reply);
        throw err;
      }

      setRefreshCookie(reply, rotated.session.token, rotated.session.expiresAt);

      const [user] = await db.select().from(s.users).where(eq(s.users.id, rotated.userId));
      if (!user) throw new ApiError('not_authenticated', 'user no longer exists');

      return {
        accessToken: await signAccessToken(user.id),
        expiresIn: ACCESS_TTL_SECONDS,
        user: publicUser(user),
        capabilities: await capabilitiesFor(user.id),
      };
    },
  );

  r.post('/auth/logout', { schema: { response: { 200: okSchema } } }, async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (token) await revokeSession(token);
    clearRefreshCookie(reply);
    return { ok: true as const };
  });
}
