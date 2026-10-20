import type { FastifyInstance } from 'fastify';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { sentMail } from '../email/index.ts';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const CREDENTIALS = {
  name: 'רן אלמוג', email: 'ran@example.co.il', password: 'a-long-enough-password',
  acceptedTerms: true as const,
};

const post = (url: string, payload?: unknown, headers?: Record<string, string>) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers });

const refreshCookieFrom = (res: Awaited<ReturnType<typeof post>>) =>
  res.cookies.find((c) => c.name === 'bb_rt');

async function openAccount(email = CREDENTIALS.email) {
  const res = await post('/auth/register', { ...CREDENTIALS, email });
  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual({ ok: true });
  const login = await post('/auth/login', { email, password: CREDENTIALS.password });
  return { res: login, body: login.json(), cookie: refreshCookieFrom(login)! };
}

describe('registration', () => {
  it('creates an account without revealing a session', async () => {
    const res = await post('/auth/register', CREDENTIALS);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });
    expect(refreshCookieFrom(res)).toBeUndefined();
    expect(sentMail.some((m) => m.to === CREDENTIALS.email)).toBe(true);
  });

  it('never stores the password in plain text', async () => {
    await openAccount();
    const [row] = await db.select().from(s.users).where(eq(s.users.email, CREDENTIALS.email));
    expect(row.passwordHash).not.toContain(CREDENTIALS.password);
    expect(row.passwordHash?.startsWith('$argon2id$')).toBe(true);
  });

  it('gives the same answer when the email already exists, and mails that address', async () => {
    await openAccount();
    sentMail.length = 0;
    const res = await post('/auth/register', CREDENTIALS);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });
    expect(refreshCookieFrom(res)).toBeUndefined();
    expect(sentMail.some((m) => m.to === CREDENTIALS.email)).toBe(true);
    expect(await db.select().from(s.users)).toHaveLength(1);
  });

  it('rejects a short password before touching the database', async () => {
    const res = await post('/auth/register', { ...CREDENTIALS, password: 'short' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details.password).toBeDefined();
    expect(await db.select().from(s.users)).toHaveLength(0);
  });

  it('refuses to create an account without accepting terms', async () => {
    const { acceptedTerms: _drop, ...withoutTerms } = CREDENTIALS;
    const res = await post('/auth/register', withoutTerms);
    expect(res.statusCode).toBe(422);
    expect(await db.select().from(s.users)).toHaveLength(0);
  });

  it('refuses acceptedTerms: false the same as leaving it out entirely', async () => {
    const res = await post('/auth/register', { ...CREDENTIALS, acceptedTerms: false });
    expect(res.statusCode).toBe(422);
  });

  it('timestamps when terms were accepted', async () => {
    const before = new Date();
    await openAccount();
    const [row] = await db.select().from(s.users).where(eq(s.users.email, CREDENTIALS.email));
    expect(row.termsAcceptedAt).not.toBeNull();
    expect(row.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe('login', () => {
  it('accepts the right password', async () => {
    await openAccount();
    const res = await post('/auth/login', { email: CREDENTIALS.email, password: CREDENTIALS.password });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(CREDENTIALS.email);
    expect(res.json().user.emailVerified).toBe(false);
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    await openAccount();
    const wrongPassword = await post('/auth/login', { email: CREDENTIALS.email, password: 'definitely-wrong-here' });
    const unknownEmail = await post('/auth/login', { email: 'nobody@example.com', password: 'definitely-wrong-here' });
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual(unknownEmail.json());
  });
});

describe('password reset', () => {
  it('gives the same answer whether or not the email exists', async () => {
    await openAccount();
    const known = await post('/auth/forgot', { email: CREDENTIALS.email });
    const unknown = await post('/auth/forgot', { email: 'nobody@example.com' });
    expect(known.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
    expect(known.json()).toEqual(unknown.json());
  });

  it('resets the password once, then revokes every session', async () => {
    const first = await openAccount();
    await post('/auth/forgot', { email: CREDENTIALS.email });
    const href = sentMail.find((m) => m.to === CREDENTIALS.email && m.subject.includes('איפוס'))!.text;
    const token = href.match(/\/reset\/([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();

    const reset = await post('/auth/reset', { token, password: 'a-brand-new-password' });
    expect(reset.statusCode).toBe(200);

    const replay = await post('/auth/reset', { token, password: 'another-new-password' });
    expect(replay.statusCode).toBe(400);

    const oldLogin = await post('/auth/login', { email: CREDENTIALS.email, password: CREDENTIALS.password });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await post('/auth/login', { email: CREDENTIALS.email, password: 'a-brand-new-password' });
    expect(newLogin.statusCode).toBe(200);

    const after = await post('/auth/refresh', undefined, { cookie: `bb_rt=${first.cookie.value}` });
    expect(after.statusCode).toBe(401);
  });
});

describe('email verification', () => {
  it('marks the account verified and opens a session', async () => {
    await post('/auth/register', CREDENTIALS);
    const href = sentMail.find((m) => m.to === CREDENTIALS.email)!.text;
    const token = href.match(/\/verify\/([A-Za-z0-9_-]+)/)?.[1];
    const res = await post('/auth/verify', { token });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.emailVerified).toBe(true);
    expect(refreshCookieFrom(res)?.httpOnly).toBe(true);
  });
});

describe('refresh rotation', () => {
  it('issues a new refresh token and invalidates the old one', async () => {
    const first = await openAccount();
    const second = await post('/auth/refresh', undefined, { cookie: `bb_rt=${first.cookie.value}` });
    expect(second.statusCode).toBe(200);
    const rotated = refreshCookieFrom(second)!;
    expect(rotated.value).not.toBe(first.cookie.value);
  });

  it('lets a second tab refresh inside the grace window', async () => {
    const first = await openAccount();
    await post('/auth/refresh', undefined, { cookie: `bb_rt=${first.cookie.value}` });
    const overlap = await post('/auth/refresh', undefined, { cookie: `bb_rt=${first.cookie.value}` });
    expect(overlap.statusCode).toBe(200);
    expect(refreshCookieFrom(overlap)?.value).toBeTruthy();
  });

  it('rejects an unknown refresh token', async () => {
    const res = await post('/auth/refresh', undefined, { cookie: 'bb_rt=not-a-real-token' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('session_expired');
  });

  it('stores only a hash of the refresh token', async () => {
    const { cookie, body } = await openAccount();
    const [row] = await db.select().from(s.sessions).where(eq(s.sessions.userId, body.user.id));
    expect(row.tokenHash).not.toBe(cookie.value);
    expect(row.tokenHash).toHaveLength(64);
  });

  it('refuses a deleted account', async () => {
    const first = await openAccount();
    await db.update(s.users).set({ deletedAt: new Date() }).where(eq(s.users.id, first.body.user.id));
    const res = await post('/auth/refresh', undefined, { cookie: `bb_rt=${first.cookie.value}` });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /me', () => {
  it('needs a bearer token', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('not_authenticated');
  });

  it('rejects a forged token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3JfaGackJ9.nope' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns the account and its derived capabilities', async () => {
    const { body } = await openAccount();
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(CREDENTIALS.email);
    expect(res.json().capabilities.isOwner).toBe(false);
  });
});

describe('capabilities come from relationships, not a role column', () => {
  it('makes someone an owner by owning, and a tenant by holding a lease', async () => {
    const landlord = await openAccount();
    const tenant = await openAccount('michal@example.com');

    const propertyId = newId('property');
    await db.insert(s.properties).values({
      id: propertyId,
      ownerId: landlord.body.user.id,
      street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
      lat: '32.0651', lng: '34.7708',
      rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
      monthlyRentAgorot: 1_040_000, status: 'occupied',
    });
    await db.insert(s.leases).values({
      id: newId('lease'),
      propertyId,
      tenantId: tenant.body.user.id,
      startDate: '2025-07-15',
      endDate: '2099-07-15',
      monthlyRentAgorot: 1_040_000,
      paymentMethod: 'bank_transfer',
    });

    const asLandlord = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${landlord.body.accessToken}` } });
    const asTenant = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${tenant.body.accessToken}` } });

    expect(asLandlord.json().capabilities).toMatchObject({ isOwner: true, ownedPropertyCount: 1, isTenant: false });
    expect(asTenant.json().capabilities).toMatchObject({ isOwner: false, isTenant: true });
    expect(asTenant.json().capabilities.activeLeaseIds).toHaveLength(1);
  });
});

describe('logout', () => {
  it('revokes the session so the cookie stops working', async () => {
    const { cookie, body } = await openAccount();
    const res = await post('/auth/logout', undefined, {
      cookie: `bb_rt=${cookie.value}`,
      authorization: `Bearer ${body.accessToken}`,
    });
    expect(res.statusCode).toBe(200);

    const after = await post('/auth/refresh', undefined, { cookie: `bb_rt=${cookie.value}` });
    expect(after.statusCode).toBe(401);
  });
});
