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
 * Fly's own header, not X-Forwarded-For. Anyone can send X-Forwarded-For;
 * only Fly can set Fly-Client-IP on the public service.
 */
export function clientIp(request: FastifyRequest): string {
  const fly = request.headers['fly-client-ip'];
  if (typeof fly === 'string' && fly.length > 0) return fly.split(',')[0]!.trim();
  return request.socket.remoteAddress ?? '0.0.0.0';
}

export function clientMeta(request: FastifyRequest) {
  return { userAgent: request.headers['user-agent'], ip: clientIp(request) };
}
