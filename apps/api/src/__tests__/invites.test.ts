import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * Tenant invites — the only door into the tenant role.
 *
 * The tests hold the lines that matter: the owner sets the terms and the
 * acceptor cannot change them; a link works once; a new link retires the old
 * one; only the owner can make, list or revoke; and the stored row never
 * contains a usable token.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let renter = { id: '', token: '' };
let other = { id: '', token: '' };
let propertyId: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST' | 'DELETE', url: string, token?: string, payload?: unknown) =>
  app.inject({
    method,
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: payload as object,
  });

async function makeUser(name: string, email: string) {
  const id = newId('user');
  await db.insert(s.users).values({ id, name, email, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

const terms = {
  startDate: iso(-1),
  endDate: iso(364),
  monthlyRentShekels: 7200,
  depositShekels: 14400,
  paymentMethod: 'bank_transfer',
  tenantName: 'עמית',
};

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`);
  renter = await makeUser('עמית כהן', `ren-${n}@example.com`);
  other = await makeUser('זר', `oth-${n}@example.com`);

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'לבנדה', houseNumber: '14', city: 'תל אביב-יפו', neighborhood: 'פלורנטין',
    lat: '32.0565', lng: '34.7700', rooms: '2.5', sqm: 60, floor: 2, totalFloors: 4,
    monthlyRentAgorot: 720_000, status: 'vacant', listed: true,
  });
});

async function invite(body: object = terms) {
  const res = await req('POST', `/properties/${propertyId}/invites`, owner.token, body);
  expect(res.statusCode).toBe(201);
  return res.json() as { invite: { id: string; status: string }; token: string };
}

describe('making an invite', () => {
  it('returns the token once and stores only its hash', async () => {
    const { invite: made, token } = await invite();
    expect(made.status).toBe('open');
    expect(token.length).toBeGreaterThanOrEqual(30);

    const [row] = await db.select().from(s.tenantInvites).where(eq(s.tenantInvites.id, made.id));
    expect(JSON.stringify(row)).not.toContain(token);

    const list = (await req('GET', `/properties/${propertyId}/invites`, owner.token)).json();
    expect(JSON.stringify(list)).not.toContain(token);
  });

  it('is owner-only, and answers 404 rather than 403 to anyone else', async () => {
    const res = await req('POST', `/properties/${propertyId}/invites`, other.token, terms);
    expect(res.statusCode).toBe(404);
    const list = await req('GET', `/properties/${propertyId}/invites`, other.token);
    expect(list.statusCode).toBe(404);
  });

  it('retires the previous link when a new one is made', async () => {
    const first = await invite();
    await invite();
    const preview = (await req('GET', `/join/${first.token}`)).json();
    expect(preview.status).toBe('revoked');
  });

  it('refuses terms that overlap a lease already on the unit', async () => {
    await db.insert(s.leases).values({
      id: newId('lease'), propertyId, tenantId: other.id,
      startDate: iso(-100), endDate: iso(30), monthlyRentAgorot: 700_000, paymentMethod: 'bank_transfer',
    });
    const res = await req('POST', `/properties/${propertyId}/invites`, owner.token, terms);
    expect(res.statusCode).toBe(422);
  });

  it('refuses an end date before the start', async () => {
    const res = await req('POST', `/properties/${propertyId}/invites`, owner.token, {
      ...terms, endDate: iso(-30),
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('the link', () => {
  it('shows the terms and the owner’s first name — nothing else — without signing in', async () => {
    const { token } = await invite();
    const res = await req('GET', `/join/${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'open', propertyLabel: 'לבנדה 14', ownerFirstName: 'רן',
      monthlyRentAgorot: 720_000, depositAgorot: 1_440_000,
    });
    expect(res.body).not.toContain('@example.com');
    expect(res.body).not.toContain('עמית');
  });

  it('answers 404 to a token that does not exist', async () => {
    const res = await req('GET', `/join/${'x'.repeat(32)}`);
    expect(res.statusCode).toBe(404);
  });
});

describe('accepting', () => {
  it('creates the lease on the owner’s terms and makes the account a tenant', async () => {
    const { token } = await invite();
    const res = await req('POST', `/join/${token}/accept`, renter.token);
    expect(res.statusCode).toBe(200);
    const { leaseId } = res.json();

    const [lease] = await db.select().from(s.leases).where(eq(s.leases.id, leaseId));
    expect(lease).toMatchObject({ tenantId: renter.id, propertyId, monthlyRentAgorot: 720_000, depositAgorot: 1_440_000 });

    const [property] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
    expect(property.status).toBe('occupied');

    const mine = (await req('GET', '/properties', renter.token)).json().properties;
    expect(mine.map((p: { id: string; scope: string }) => [p.id, p.scope])).toContainEqual([propertyId, 'tenant']);
  });

  it('works once', async () => {
    const { token } = await invite();
    await req('POST', `/join/${token}/accept`, renter.token);
    const again = await req('POST', `/join/${token}/accept`, other.token);
    expect(again.statusCode).toBe(403);
  });

  it('refuses the owner accepting their own invite', async () => {
    const { token } = await invite();
    const res = await req('POST', `/join/${token}/accept`, owner.token);
    expect(res.statusCode).toBe(403);
  });

  it('refuses a revoked link', async () => {
    const { invite: made, token } = await invite();
    const del = await req('DELETE', `/invites/${made.id}`, owner.token);
    expect(del.statusCode).toBe(200);
    const res = await req('POST', `/join/${token}/accept`, renter.token);
    expect(res.statusCode).toBe(403);
  });

  it('requires a session to accept', async () => {
    const { token } = await invite();
    const res = await req('POST', `/join/${token}/accept`);
    expect(res.statusCode).toBe(401);
  });
});
