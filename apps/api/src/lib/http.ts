import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '@miftan/shared';
import { env, isProd } from './env.ts';

export const REFRESH_COOKIE = 'bb_rt';

/**
 * httpOnly so no script can read it, sameSite=lax so it survives a normal
 * navigation but not a cross-site POST, and scoped to COOKIE_PATH so it is not
 * attached to every ordinary API call.
 */
export function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: env.COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: env.COOKIE_PATH });
}

export function readRefreshCookie(request: FastifyRequest): string {
  const token = request.cookies[REFRESH_COOKIE];
  if (!token) throw new ApiError('not_authenticated', 'no refresh cookie');
  return token;
}

/**
 * The caller's address, as the hosting platform saw it.
 *
 * Google Cloud Run's front end appends the address it received the request
 * from to X-Forwarded-For, so the LAST entry is the one a caller cannot
 * forge; anything before it was written by the caller. (Taking the first
 * entry, as many examples do, lets anyone pick their own IP and walk around
 * the rate limits.)
 */
export function clientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  if (typeof value === 'string' && value.length > 0) {
    const last = value.split(',').pop()!.trim();
    if (last) return last;
  }
  return request.socket.remoteAddress ?? '0.0.0.0';
}

export function clientMeta(request: FastifyRequest) {
  return { userAgent: request.headers['user-agent'], ip: clientIp(request) };
}
