import type { FastifyInstance } from 'fastify';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const CREDENTIALS = { name: 'רן אלמוג', email: 'ran@example.co.il', password: 'a-long-enough-password' };

/** Fastify's inject needs no port, so the suite never binds one. */
const post = (url: string, payload?: unknown, headers?: Record<string, string>) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers });

const refreshCookieFrom = (res: Awaited<ReturnType<typeof post>>) =>
  res.cookies.find((c) => c.name === 'miftan_rt');

async function register() {
  const res = await post('/auth/register', CREDENTIALS);
  return { res, body: res.json(), cookie: refreshCookieFrom(res)! };
}

describe('registration', () => {
  it('creates an account and returns a session', async () => {
    const { res, body, cookie } = await register();
    expect(res.statusCode).toBe(201);
    expect(body.user.email).toBe(CREDENTIALS.email);
    expect(body.accessToken).toBeTypeOf('string');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe('/auth');
  });

  it('never stores the password in plain text', async () => {
    const { body } = await register();
    const [row] = await db.select().from(s.users).where(eq(s.users.id, body.user.id));
    expect(row.passwordHash).not.toContain(CREDENTIALS.password);
    expect(row.passwordHash?.startsWith('$argon2id$')).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    await register();
    const res = await post('/auth/register', CREDENTIALS);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('email_taken');
  });

  it('rejects a short password before touching the database', async () => {
    const res = await post('/auth/register', { ...CREDENTIALS, password: 'short' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details.password).toBeDefined();
    expect(await db.select().from(s.users)).toHaveLength(0);
  });
});

describe('login', () => {
  it('accepts the right password', async () => {
    await register();
    const res = await post('/auth/login', { email: CREDENTIALS.email, password: CREDENTIALS.password });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(CREDENTIALS.email);
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    await register();
    const wrongPassword = await post('/auth/login', { email: CREDENTIALS.email, password: 'definitely-wrong-here' });
    const unknownEmail = await post('/auth/login', { email: 'nobody@example.com', password: 'definitely-wrong-here' });

    /* Identical status and code, so this endpoint cannot be used to find out
       which addresses are registered. */
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual(unknownEmail.json());
  });
});

describe('refresh rotation', () => {
  it('issues a new refresh token and invalidates the old one', async () => {
    const first = await register();

    const second = await post('/auth/refresh', undefined, { cookie: `miftan_rt=${first.cookie.value}` });
    expect(second.statusCode).toBe(200);
    const rotated = refreshCookieFrom(second)!;
    expect(rotated.value).not.toBe(first.cookie.value);
  });

  it('revokes every session when a used token is replayed', async () => {
    const first = await register();
    await post('/auth/refresh', undefined, { cookie: `miftan_rt=${first.cookie.value}` });

    /* Presenting the already-rotated token means it leaked or was copied. We
       cannot tell which, so every session for that user ends. */
    const replay = await post('/auth/refresh', undefined, { cookie: `miftan_rt=${first.cookie.value}` });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error.code).toBe('session_reused');

    const live = await db.select().from(s.sessions).where(eq(s.sessions.userId, first.body.user.id));
    expect(live.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await post('/auth/refresh', undefined, { cookie: 'miftan_rt=not-a-real-token' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('session_expired');
  });

  it('stores only a hash of the refresh token', async () => {
    const { cookie, body } = await register();
    const [row] = await db.select().from(s.sessions).where(eq(s.sessions.userId, body.user.id));
    expect(row.tokenHash).not.toBe(cookie.value);
    expect(row.tokenHash).toHaveLength(64);
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
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3JfaGFjayJ9.nope' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns the account and its derived capabilities', async () => {
    const { body } = await register();
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
    const landlord = await register();
    const tenantRes = await post('/auth/register', {
      name: 'מיכל שטרן',
      email: 'michal@example.com',
      password: 'another-long-password',
    });
    const tenant = tenantRes.json();

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
      tenantId: tenant.user.id,
      startDate: '2025-07-15',
      /* Far enough out that the lease is unambiguously active. */
      endDate: '2099-07-15',
      monthlyRentAgorot: 1_040_000,
      paymentMethod: 'bank_transfer',
    });

    const asLandlord = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${landlord.body.accessToken}` } });
    const asTenant = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${tenant.accessToken}` } });

    expect(asLandlord.json().capabilities).toMatchObject({ isOwner: true, ownedPropertyCount: 1, isTenant: false });
    expect(asTenant.json().capabilities).toMatchObject({ isOwner: false, isTenant: true });
    expect(asTenant.json().capabilities.activeLeaseIds).toHaveLength(1);
  });
});

describe('logout', () => {
  it('revokes the session so the cookie stops working', async () => {
    const { cookie, body } = await register();
    const res = await post('/auth/logout', undefined, {
      cookie: `miftan_rt=${cookie.value}`,
      authorization: `Bearer ${body.accessToken}`,
    });
    expect(res.statusCode).toBe(200);

    const after = await post('/auth/refresh', undefined, { cookie: `miftan_rt=${cookie.value}` });
    expect(after.statusCode).toBe(401);
  });
});
