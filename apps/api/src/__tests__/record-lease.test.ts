import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';
import { sentMail } from '../email/index.ts';

/**
 * A landlord arrives with a tenant already living in the flat. The lease is
 * recorded without an invite, and the tenant can be invited onto that same
 * lease later.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let renter = { id: '', token: '' };
let propertyId: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST', url: string, token?: string, payload?: unknown) =>
  app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: payload as object });

async function makeUser(name: string) {
  const id = newId('user');
  const email = `${id}@example.com`;
  await db.insert(s.users).values({
    id, name, email, passwordHash: await hashPassword(PASSWORD), emailVerifiedAt: new Date(),
  });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const terms = {
  startDate: day(-60),
  endDate: day(300),
  monthlyRentShekels: 6500,
  depositShekels: 13000,
  paymentMethod: 'standing_order',
};

beforeEach(async () => {
  owner = await makeUser('בעלת הדירה');
  renter = await makeUser('דייר אמיתי');
  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'הרצל', houseNumber: '10', city: 'חיפה', neighborhood: 'הדר',
    lat: '32.81', lng: '34.99', rooms: '3', sqm: 70, floor: 1, totalFloors: 3,
    monthlyRentAgorot: 650_000, status: 'vacant', listed: true,
  });
});

const record = (body: object = {}) =>
  req('POST', `/properties/${propertyId}/leases`, owner.token, {
    ...terms, tenantName: 'יוסי לוי', tenantPhone: '052-1234567', ...body,
  });

describe('recording an existing tenancy', () => {
  it('creates the lease and marks a started lease occupied', async () => {
    const res = await record();
    expect(res.statusCode).toBe(201);

    const unit = (await req('GET', `/properties/${propertyId}`, owner.token)).json();
    expect(unit.status).toBe('occupied');
    expect(unit.listed).toBe(false);
    expect(unit.tenant.name).toBe('יוסי לוי');
    expect(unit.lease.monthlyRentAgorot).toBe(650_000);
  });

  it('refuses a second lease over the same dates', async () => {
    await record();
    expect((await record({ tenantName: 'מישהו אחר' })).statusCode).toBe(422);
  });

  it('is owner-only', async () => {
    const res = await req('POST', `/properties/${propertyId}/leases`, renter.token, { ...terms, tenantName: 'x' });
    expect(res.statusCode).toBe(404);
  });

  it('the recorded tenant cannot sign in, and is never mailed', async () => {
    await record();
    const [lease] = await db.select().from(s.leases).where(eq(s.leases.propertyId, propertyId));
    const [placeholder] = await db.select().from(s.users).where(eq(s.users.id, lease!.tenantId));
    expect(placeholder!.passwordHash).toBeNull();

    await req('POST', '/auth/forgot', undefined, { email: placeholder!.email });
    expect(sentMail.filter((m) => m.to === placeholder!.email)).toHaveLength(0);
  });
});

describe('inviting a recorded tenant later', () => {
  it('hands the same lease to the account that accepts', async () => {
    const { leaseId } = (await record()).json();

    const made = await req('POST', `/properties/${propertyId}/invites`, owner.token, { ...terms, tenantName: 'יוסי לוי' });
    expect(made.statusCode).toBe(201);

    const accepted = await req('POST', `/join/${made.json().token}/accept`, renter.token);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().leaseId).toBe(leaseId);

    const [lease] = await db.select().from(s.leases).where(eq(s.leases.id, leaseId));
    expect(lease!.tenantId).toBe(renter.id);
    const mine = (await req('GET', `/properties/${propertyId}`, renter.token)).json();
    expect(mine.scope).toBe('tenant');
  });

  it('still refuses an invite over a lease that belongs to a real account', async () => {
    await db.insert(s.leases).values({
      id: newId('lease'), propertyId, tenantId: renter.id,
      startDate: terms.startDate, endDate: terms.endDate,
      monthlyRentAgorot: 650_000, paymentMethod: 'bank_transfer',
    });
    const res = await req('POST', `/properties/${propertyId}/invites`, owner.token, terms);
    expect(res.statusCode).toBe(422);
  });
});
