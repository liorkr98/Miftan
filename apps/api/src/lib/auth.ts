import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { ApiError } from '@miftan/shared';
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

/**
 * The HMAC key for access tokens. JWT_SECRET when set (a Worker secret);
 * otherwise one generated on first use and kept in app_meta, so a fresh
 * deploy signs people in without anyone pasting a secret anywhere.
 * HUMAN REVIEW: with the stored key, anyone who can read the database could
 * mint tokens — set JWT_SECRET on the Worker to take it out of the database.
 */
let signingKey: Uint8Array | null = null;

/** Load the key before serving, so the synchronous users below can rely on it. */
export const loadServerSecret = (): Promise<Uint8Array> => secret();

/**
 * The same key, for code that cannot await: signing file links inside a
 * projection, salting an anonymous viewer's hash.
 */
export function serverSecretSync(): Uint8Array {
  if (signingKey) return signingKey;
  if (env.JWT_SECRET) return (signingKey = new TextEncoder().encode(env.JWT_SECRET));
  throw new Error('server secret not loaded: await loadServerSecret() before serving');
}

async function secret(): Promise<Uint8Array> {
  if (signingKey) return signingKey;
  if (env.JWT_SECRET) return (signingKey = new TextEncoder().encode(env.JWT_SECRET));
  await db
    .insert(s.appMeta)
    .values({ key: 'jwt_secret', value: randomBytes(48).toString('base64url') })
    .onConflictDoNothing();
  const [row] = await db.select().from(s.appMeta).where(eq(s.appMeta.key, 'jwt_secret'));
  return (signingKey = new TextEncoder().encode(row.value));
}

/* ── Passwords ─────────────────────────────────────────── */

/**
 * PBKDF2-SHA256 through Web Crypto, because the API runs in a Cloudflare
 * Worker and argon2 is native code a Worker cannot load.
 *
 * HUMAN REVIEW: the iteration count is a trade between how expensive a leaked
 * hash is to crack and the Worker's CPU budget per request — about 6ms here,
 * against the free plan's 10ms. On a paid plan, raise it toward OWASP's
 * 600,000. It is stored in every hash, so raising it later only affects new
 * and re-set passwords — nothing has to be migrated. Tests use a token count
 * so the suite is not spent hashing.
 */
export const PBKDF2_ITERATIONS = env.NODE_ENV === 'test' ? 1_000 : 50_000;
const PREFIX = 'pbkdf2_sha256';

async function derive(plain: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(plain), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(plain: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = new Uint8Array(randomBytes(16));
  const hash = await derive(plain, salt, iterations);
  return `${PREFIX}$${iterations}$${Buffer.from(salt).toString('base64')}$${Buffer.from(hash).toString('base64')}`;
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    const [prefix, iter, salt, hash] = stored.split('$');
    const iterations = Number(iter);
    if (prefix !== PREFIX || !Number.isInteger(iterations) || iterations < 1) return false;
    const expected = Buffer.from(hash, 'base64');
    const actual = await derive(plain, new Uint8Array(Buffer.from(salt, 'base64')), iterations);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
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
    .setIssuer('miftan')
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(await secret());
}

export async function verifyAccessToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, await secret(), { issuer: 'miftan' });
    if (!payload.sub) throw new Error('no subject');
    return payload.sub;
  } catch {
    throw new ApiError('not_authenticated', 'invalid or expired access token');
  }
}

/* ── Refresh sessions ──────────────────────────────────── */

export const hashToken = (v: string) => createHash('sha256').update(v).digest('hex');
const sha256 = hashToken;

/** Two tabs that refresh in the same beat share a grace window instead of
    signing the user out everywhere. After this, a replay is treated as theft. */
export const REFRESH_GRACE_MS = 10_000;

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string; ip?: string },
  id: string = newId('session'),
): Promise<IssuedSession> {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);

  await db.insert(s.sessions).values({
    id,
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

  if (!existing.revokedAt && existing.expiresAt.getTime() < Date.now()) {
    throw new ApiError('session_expired', 'refresh token expired');
  }

  if (!existing.revokedAt) {
    /* D1 has no row locks, so the claim is the lock: only one of two racing
       refreshes flips revoked_at from null. The loser falls through to the
       grace check below, exactly as if it had arrived a moment later. */
    const replacementId = newId('session');
    const claimed = await db
      .update(s.sessions)
      .set({ revokedAt: new Date(), replacedBySessionId: replacementId })
      .where(and(eq(s.sessions.id, existing.id), isNull(s.sessions.revokedAt)))
      .returning({ id: s.sessions.id });
    if (claimed.length === 1) {
      return { userId: existing.userId, session: await createSession(existing.userId, meta, replacementId) };
    }
  }

  const [current] = await db.select().from(s.sessions).where(eq(s.sessions.id, existing.id));
  const revokedAt = current?.revokedAt ?? new Date();
  const age = Date.now() - revokedAt.getTime();
  /* Grace is only for a rotation overlap (two tabs). A logout, a reset or
     "sign out everywhere" leaves replacedBySessionId empty. */
  if (current?.replacedBySessionId && age <= REFRESH_GRACE_MS) {
    return { userId: existing.userId, session: await createSession(existing.userId, meta) };
  }
  if (current?.replacedBySessionId) {
    await revokeAllSessions(existing.userId);
    throw new ApiError('session_reused', 'refresh token replayed; all sessions revoked');
  }
  throw new ApiError('session_expired', 'refresh token revoked');
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
  await db.delete(s.sessions).where(lt(s.sessions.expiresAt, new Date()));
}

/** Constant-time compare, for anything that is not a password hash. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
