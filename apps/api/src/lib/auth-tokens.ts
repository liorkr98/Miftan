import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { ApiError } from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from './ids.ts';
import { hashToken } from './auth.ts';

export type AuthPurpose = 'reset' | 'verify' | 'email_change';

const TTL_MS: Record<AuthPurpose, number> = {
  reset: 60 * 60_000,
  verify: 24 * 60 * 60_000,
  email_change: 60 * 60_000,
};

export async function issueAuthToken(
  userId: string,
  purpose: AuthPurpose,
  payload: string | null = null,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.insert(s.authTokens).values({
    id: newId('authToken'),
    userId,
    purpose,
    tokenHash: hashToken(token),
    payload,
    expiresAt: new Date(Date.now() + TTL_MS[purpose]),
  });
  return token;
}

export async function consumeAuthToken(token: string, purpose: AuthPurpose) {
  const hash = hashToken(token);
  const [row] = await db
    .select()
    .from(s.authTokens)
    .where(and(eq(s.authTokens.tokenHash, hash), eq(s.authTokens.purpose, purpose)));

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw new ApiError('invalid_token', 'this link is expired or already used');
  }

  await db.update(s.authTokens).set({ usedAt: new Date() }).where(eq(s.authTokens.id, row.id));
  return row;
}

/** A new token of the same purpose retires unused ones, so an old inbox link dies. */
export async function retireUnused(userId: string, purpose: AuthPurpose): Promise<void> {
  await db
    .update(s.authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(eq(s.authTokens.userId, userId), eq(s.authTokens.purpose, purpose), isNull(s.authTokens.usedAt)),
    );
}
