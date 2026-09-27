import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '@miftan/shared';
import { env } from './env.ts';
import { clientIp } from './http.ts';

/**
 * In-process limiter. No new package — @fastify/rate-limit was proposed and
 * not yet approved. A single API machine is enough for beta; Redis comes
 * when there is more than one.
 *
 * Disabled under test so the suite does not trip itself.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(opts: { windowMs: number; max: number; name: string }) {
  return async function limit(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (env.NODE_ENV === 'test') return;
    const key = `${opts.name}:${clientIp(request)}`;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return;
    }
    current.count += 1;
    if (current.count > opts.max) {
      throw new ApiError('rate_limited', 'too many requests');
    }
  };
}

export const authBurst = rateLimit({ name: 'auth', windowMs: 15 * 60_000, max: 20 });
export const refreshBurst = rateLimit({ name: 'refresh', windowMs: 60_000, max: 60 });
export const joinBurst = rateLimit({ name: 'join', windowMs: 60 * 60_000, max: 30 });
export const searchBurst = rateLimit({ name: 'search', windowMs: 60_000, max: 60 });
export const uploadBurst = rateLimit({ name: 'upload', windowMs: 60 * 60_000, max: 40 });
