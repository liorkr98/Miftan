import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { and, eq, isNull } from 'drizzle-orm';
import { ApiError } from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { supabaseAuthEnabled, verifyAccessToken, verifySupabaseToken } from '../lib/auth.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `authenticate`; absent on public routes. */
    currentUser?: { id: string; name: string; email: string };
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    /** Populates currentUser when a token is present; never rejects. */
    optionalAuth: (request: FastifyRequest) => Promise<void>;
  }
}

const USER_COLUMNS = { id: s.users.id, name: s.users.name, email: s.users.email };

/**
 * Resolve a bearer token to the row it speaks for, whichever system issued it.
 *
 * Two issuers are accepted. This API's own tokens are tried first: they are
 * verified against a local secret with no network call, and they are what every
 * existing session and every test uses. A token that is not ours is then tried
 * against Supabase Auth, whose subject is matched on `supabaseUserId` rather
 * than `id` — Supabase mints its own uuids and knows nothing about ours.
 *
 * Accepting both is what makes the move to Supabase Auth survivable: accounts
 * migrate one at a time instead of everyone being signed out at once.
 */
async function userForToken(token: string) {
  try {
    const userId = await verifyAccessToken(token);
    const [user] = await db
      .select(USER_COLUMNS)
      .from(s.users)
      .where(and(eq(s.users.id, userId), isNull(s.users.deletedAt)));
    return user ?? null;
  } catch (err) {
    if (!supabaseAuthEnabled()) throw err;
  }

  const { sub: subject } = await verifySupabaseToken(token);
  const [user] = await db
    .select(USER_COLUMNS)
    .from(s.users)
    .where(and(eq(s.users.supabaseUserId, subject), isNull(s.users.deletedAt)));
  return user ?? null;
}

/**
 * A single entry point for "who is calling". Phase 3 builds the authorization
 * layer on top of this — authentication answers *who*, authorization answers
 * *what they may see*, and keeping them apart is what stops the second one
 * being quietly forgotten on a new route.
 */
export const authenticatePlugin = fp(async (app: FastifyInstance) => {
  app.decorate('authenticate', async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError('not_authenticated', 'missing bearer token');
    }

    const user = await userForToken(header.slice(7));

    if (!user) throw new ApiError('not_authenticated', 'user no longer exists');
    request.currentUser = user;
  });

  /* Search has to work signed out, but should show a signed-in seeker their
     own queue positions. So the token is read if present and ignored if not —
     an invalid token is treated as absent rather than as an error, because a
     stale token should degrade to the anonymous view, not a 401 wall. */
  app.decorate('optionalAuth', async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    try {
      const user = await userForToken(header.slice(7));
      if (user) request.currentUser = user;
    } catch {
      /* treated as anonymous */
    }
  });
});

/** Narrows `currentUser` for routes that ran the authenticate hook. */
export function requireUser(request: FastifyRequest): { id: string; name: string; email: string } {
  if (!request.currentUser) throw new ApiError('not_authenticated', 'route is not authenticated');
  return request.currentUser;
}
