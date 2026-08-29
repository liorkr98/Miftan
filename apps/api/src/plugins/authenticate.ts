import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { and, eq, isNull } from 'drizzle-orm';
import { ApiError } from '@miftach/shared';
import { db, schema as s } from '../db/client.ts';
import { verifyAccessToken } from '../lib/auth.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `authenticate`; absent on public routes. */
    currentUser?: { id: string; name: string; email: string };
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
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

    const userId = await verifyAccessToken(header.slice(7));
    const [user] = await db
      .select({ id: s.users.id, name: s.users.name, email: s.users.email })
      .from(s.users)
      .where(and(eq(s.users.id, userId), isNull(s.users.deletedAt)));

    if (!user) throw new ApiError('not_authenticated', 'user no longer exists');
    request.currentUser = user;
  });
});

/** Narrows `currentUser` for routes that ran the authenticate hook. */
export function requireUser(request: FastifyRequest): { id: string; name: string; email: string } {
  if (!request.currentUser) throw new ApiError('not_authenticated', 'route is not authenticated');
  return request.currentUser;
}
