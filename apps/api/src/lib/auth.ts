import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { SignJWT, jwtVerify } from 'jose';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { ApiError } from '@miftach/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from './ids.ts';
import { env } from './env.ts';

/**
 * Access tokens are short-lived JWTs, verified by signature and never stored.
 * Refresh tokens are long random strings stored only as a hash, rotated on
 * every use. A leaked database therefore yields no usable sessions, and
 * revoking is a single UPDATE.
 */

export const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS = 30;

const secret = new TextEncoder().encode(env.JWT_SECRET);

/* ── Passwords ─────────────────────────────────────────── */

/** OWASP's argon2id baseline: 19 MiB, 2 passes, 1 lane. */
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, ARGON);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argonVerify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Burn roughly the same time as a real verification when the account does not
 * exist, so response timing cannot be used to enumerate registered emails.
 */
let dummyHash: string | null = null;
export async function wasteTimeLikeAVerify(): Promise<void> {
  dummyHash ??= await hashPassword(randomBytes(24).toString('hex'));
  await verifyPassword(dummyHash, 'not-the-password');
}

/* ── Access tokens ─────────────────────────────────────── */

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer('miftach')
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: 'miftach' });
    if (!payload.sub) throw new Error('no subject');
    return payload.sub;
  } catch {
    throw new ApiError('not_authenticated', 'invalid or expired access token');
  }
}

/* ── Refresh sessions ──────────────────────────────────── */

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string; ip?: string },
): Promise<IssuedSession> {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);

  await db.insert(s.sessions).values({
    id: newId('session'),
    userId,
    tokenHash: sha256(token),
    userAgent: meta.userAgent?.slice(0, 500) ?? null,
    ip: meta.ip ?? null,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Rotate: the presented token is revoked and a fresh one issued.
 *
 * If a token that was already revoked comes back, it was replayed — either the
 * user's cookie jar was copied or a token leaked. We cannot tell which, so we
 * end every session that user has and make them sign in again.
 */
export async function rotateSession(
  presented: string,
  meta: { userAgent?: string; ip?: string },
): Promise<{ userId: string; session: IssuedSession }> {
  const hash = sha256(presented);
  const [existing] = await db.select().from(s.sessions).where(eq(s.sessions.tokenHash, hash));

  if (!existing) throw new ApiError('session_expired', 'unknown refresh token');

  if (existing.revokedAt) {
    await db
      .update(s.sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(s.sessions.userId, existing.userId), isNull(s.sessions.revokedAt)));
    throw new ApiError('session_reused', 'refresh token replayed; all sessions revoked');
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    throw new ApiError('session_expired', 'refresh token expired');
  }

  const next = await createSession(existing.userId, meta);
  const [replacement] = await db
    .select({ id: s.sessions.id })
    .from(s.sessions)
    .where(eq(s.sessions.tokenHash, sha256(next.token)));

  await db
    .update(s.sessions)
    .set({ revokedAt: new Date(), replacedBySessionId: replacement?.id ?? null })
    .where(eq(s.sessions.id, existing.id));

  return { userId: existing.userId, session: next };
}

export async function revokeSession(presented: string): Promise<void> {
  await db
    .update(s.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(s.sessions.tokenHash, sha256(presented)), isNull(s.sessions.revokedAt)));
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(s.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(s.sessions.userId, userId), isNull(s.sessions.revokedAt)));
}

/** Housekeeping for a cron later; harmless to call any time. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(s.sessions).where(gt(new Date() as never, s.sessions.expiresAt));
}

/** Constant-time compare, for anything that is not a password hash. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
