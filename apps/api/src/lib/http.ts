import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '@miftan/shared';
import { env, isProd } from './env.ts';

export const REFRESH_COOKIE = 'bb_rt';

/**
 * httpOnly so no script can read it, SameSite from COOKIE_SAMESITE because the
 * right value depends on whether the app and the API share a site, and scoped
 * to COOKIE_PATH so it is not attached to every ordinary API call.
 */
export function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE,
    secure: isProd,
    path: env.COOKIE_PATH,
    expires: expiresAt,
  });
}

/* Same attributes as when set: a browser ignores a cross-site Set-Cookie that
   is not SameSite=None; Secure, so a bare clear would leave the cookie behind. */
export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE,
    secure: isProd,
    path: env.COOKIE_PATH,
  });
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
 *
 * Behind the web Worker that hop is Cloudflare, not the user, so the Worker
 * passes the real address along with PROXY_SECRET, and only then is it used.
 */
export function clientIp(request: FastifyRequest): string {
  const proxied = proxiedClientIp(request);
  if (proxied) return proxied;

  const forwarded = request.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  if (typeof value === 'string' && value.length > 0) {
    const last = value.split(',').pop()!.trim();
    if (last) return last;
  }
  return request.socket.remoteAddress ?? '0.0.0.0';
}

function proxiedClientIp(request: FastifyRequest): string | null {
  if (!env.PROXY_SECRET) return null;
  const secret = request.headers['x-bb-proxy-secret'];
  const ip = request.headers['x-bb-client-ip'];
  if (typeof secret !== 'string' || typeof ip !== 'string' || ip.length === 0) return null;
  const given = Buffer.from(secret);
  const expected = Buffer.from(env.PROXY_SECRET);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return ip.trim().slice(0, 64);
}

export function clientMeta(request: FastifyRequest) {
  return { userAgent: request.headers['user-agent'], ip: clientIp(request) };
}
