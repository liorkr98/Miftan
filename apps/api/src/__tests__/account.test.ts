import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { sentMail } from '../email/index.ts';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const PASSWORD = 'a-long-enough-password';

async function signedIn() {
  const email = `acc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { name: 'בודק', email, password: PASSWORD, acceptedTerms: true },
  });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: PASSWORD },
  });
  return {
    email,
    token: login.json().accessToken as string,
    cookie: login.cookies.find((c) => c.name === 'bb_rt')!.value,
  };
}

const auth = (token: string, cookie?: string) => ({
  authorization: `Bearer ${token}`,
  ...(cookie ? { cookie: `bb_rt=${cookie}` } : {}),
});

describe('account self-service', () => {
  it('changes the password when the current one is right', async () => {
    const u = await signedIn();
    const wrong = await app.inject({
      method: 'POST', url: '/me/password',
      headers: auth(u.token),
      payload: { currentPassword: 'nope-nope-nope', newPassword: 'a-fresh-password' },
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await app.inject({
      method: 'POST', url: '/me/password',
      headers: auth(u.token),
      payload: { currentPassword: PASSWORD, newPassword: 'a-fresh-password' },
    });
    expect(ok.statusCode).toBe(200);

    const login = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: u.email, password: 'a-fresh-password' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('lists the current session and can sign out everywhere', async () => {
    const u = await signedIn();
    const list = await app.inject({ method: 'GET', url: '/me/sessions', headers: auth(u.token, u.cookie) });
    expect(list.statusCode).toBe(200);
    expect(list.json().sessions.some((row: { current: boolean }) => row.current)).toBe(true);

    const revoke = await app.inject({
      method: 'POST', url: '/me/sessions/revoke-all', headers: auth(u.token),
    });
    expect(revoke.statusCode).toBe(200);
    const refresh = await app.inject({
      method: 'POST', url: '/auth/refresh', headers: { cookie: `bb_rt=${u.cookie}` },
    });
    expect(refresh.statusCode).toBe(401);
  });

  it('mails a change-of-email link and does not switch until it is used', async () => {
    const u = await signedIn();
    const next = `next-${Date.now()}@example.com`;
    sentMail.length = 0;
    const res = await app.inject({
      method: 'POST', url: '/me/email',
      headers: auth(u.token),
      payload: { email: next, password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    const [row] = await db.select().from(s.users).where(eq(s.users.email, u.email));
    expect(row).toBeTruthy();
    const href = sentMail.find((m) => m.to === next)!.text;
    const token = href.match(/\/verify\/([A-Za-z0-9_-]+)/)?.[1];
    const verify = await app.inject({ method: 'POST', url: '/auth/verify', payload: { token } });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().user.email).toBe(next);
  });

  it('soft-deletes the account', async () => {
    const u = await signedIn();
    const res = await app.inject({
      method: 'POST', url: '/me/delete',
      headers: auth(u.token),
      payload: { password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    const login = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: u.email, password: PASSWORD },
    });
    expect(login.statusCode).toBe(401);
  });
});
