import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql as dsql } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';
import { accountIsDemo } from '../routes/auth.ts';

/**
 * The plan decides what an account can open, so it fails closed: a new
 * account is free, only an exact 'pro' is paid, and anything else the column
 * might hold reads as free.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function signedIn() {
  const id = newId('user');
  const email = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await db.insert(s.users).values({ id, name: 'בודק', email, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string, login: res.json() };
}

const me = async (token: string) =>
  (await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } })).json();

describe('plan', () => {
  it('starts free, on login and on /me', async () => {
    const u = await signedIn();
    expect(u.login.user.plan).toBe('free');
    expect((await me(u.token)).user.plan).toBe('free');
  });

  it('reads pro when the account has it', async () => {
    const u = await signedIn();
    await db.update(s.users).set({ plan: 'pro' }).where(eq(s.users.id, u.id));
    expect((await me(u.token)).user.plan).toBe('pro');
  });

  it('reads anything unrecognised as free', async () => {
    const u = await signedIn();
    await db.execute(dsql`update users set plan = 'gold' where id = ${u.id}`);
    expect((await me(u.token)).user.plan).toBe('free');
  });

  it('does not treat a seeded id as demo on production', () => {
    expect(accountIsDemo('usr_seed_own-1', true, false)).toBe(false);
    expect(accountIsDemo('usr_seed_own-1', true, true)).toBe(true);
    expect(accountIsDemo('usr_real', false, true)).toBe(false);
  });

  it('marks only seeded accounts as demo', async () => {
    const real = await signedIn();
    expect(real.login.user.isDemo).toBe(false);

    const id = 'usr_seed_plan-demo';
    const email = `demo-${Date.now()}@example.com`;
    await db.insert(s.users).values({ id, name: 'דמו', email, passwordHash: await hashPassword(PASSWORD) });
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
    expect(res.json().user.isDemo).toBe(true);
  });

  it('remembers a closed onboarding checklist, once per role', async () => {
    const u = await signedIn();
    expect(u.login.user.onboardingDismissed).toEqual([]);
    const dismiss = (role: string) =>
      app.inject({
        method: 'POST', url: '/me/onboarding/dismiss',
        headers: { authorization: `Bearer ${u.token}` }, payload: { role },
      });
    expect((await dismiss('owner')).statusCode).toBe(200);
    await dismiss('owner');
    expect((await me(u.token)).user.onboardingDismissed).toEqual(['owner']);
    expect((await dismiss('admin')).statusCode).toBe(422);
  });
});
