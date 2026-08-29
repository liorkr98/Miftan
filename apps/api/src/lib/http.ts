import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '@miftach/shared';
import { isProd } from './env.ts';

export const REFRESH_COOKIE = 'miftach_rt';

/**
 * httpOnly so no script can read it, sameSite=lax so it survives a normal
 * navigation but not a cross-site POST, and scoped to the refresh path so it
 * is not sent with every ordinary request.
 */
export function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/auth',
    expires: expiresAt,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: '/auth' });
}

export function readRefreshCookie(request: FastifyRequest): string {
  const token = request.cookies[REFRESH_COOKIE];
  if (!token) throw new ApiError('not_authenticated', 'no refresh cookie');
  return token;
}

export function clientMeta(request: FastifyRequest) {
  return { userAgent: request.headers['user-agent'], ip: request.ip };
}
