import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * Rent collected, scoped the same way as every other mixed list: an owner
 * sees the tenants on their units; a tenant sees only their own months; a
 * seeker sees an empty list, not a 403 that would confirm the table exists.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';

let owner = { id: '', token: '' };
let tenant = { id: '', token: '' };
let otherTenant = { id: '', token: '' };
let seeker = { id: '', token: '' };
let propertyId = '';
let otherPropertyId = '';
let leaseId = '';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST', url: string, token: string) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${token}` } });

async function makeUser(name: string, email: string, phone?: string) {
  const id = newId('user');
  await db.insert(s.users).values({ id, name, email, phone: phone ?? null, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`, '0521112222');
  tenant = await makeUser('מיכל שטרן־קוראלניק', `ten-${n}@example.com`, '0543334444');
  otherTenant = await makeUser('יוסי ברק', `otherten-${n}@example.com`, '0505556666');
  seeker = await makeUser('טל אבירם', `seek-${n}@example.com`);

  propertyId = newId('property');
  otherPropertyId = newId('property');
  leaseId = newId('lease');
  const otherLease = newId('lease');

  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'occupied',
  });
  await db.insert(s.properties).values({
    id: otherPropertyId, ownerId: owner.id,
    street: 'בזל', houseNumber: '8', city: 'תל אביב-יפו', neighborhood: 'הצפון הישן',
    lat: '32.0897', lng: '34.7812', rooms: '2.5', sqm: 55, floor: 1, totalFloors: 3,
    monthlyRentAgorot: 810_000, status: 'occupied',
  });
  await db.insert(s.leases).values({
    id: leaseId, propertyId, tenantId: tenant.id,
    startDate: '2025-01-01', endDate: '2099-01-01',
    monthlyRentAgorot: 1_040_000, paymentMethod: 'standing_order',
  });
  await db.insert(s.leases).values({
    id: otherLease, propertyId: otherPropertyId, tenantId: otherTenant.id,
    startDate: '2025-01-01', endDate: '2099-01-01',
    monthlyRentAgorot: 810_000, paymentMethod: 'bank_transfer',
  });

  await db.insert(s.rentPayments).values([
    {
      id: newId('rentPayment'), propertyId, leaseId, month: '2026-08',
      dueAgorot: 1_040_000, paidAgorot: 1_040_000, paidAt: '2026-08-03', method: 'standing_order',
    },
    {
      id: newId('rentPayment'), propertyId, leaseId, month: '2026-09',
      dueAgorot: 1_040_000, paidAgorot: 0, paidAt: null, method: 'standing_order',
    },
    {
      id: newId('rentPayment'), propertyId: otherPropertyId, leaseId: otherLease, month: '2026-09',
      dueAgorot: 810_000, paidAgorot: 400_000, paidAt: '2026-09-10', method: 'bank_transfer',
    },
  ]);
});

describe('GET /rent-payments', () => {
  it('gives the owner every unit, with the tenant named', async () => {
    const res = await req('GET', '/rent-payments', owner.token);
    expect(res.statusCode).toBe(200);
    const { payments } = res.json();
    expect(payments).toHaveLength(3);
    expect(payments.every((p: { scope: string }) => p.scope === 'owner')).toBe(true);
    const names = payments.map((p: { tenant: { name: string } }) => p.tenant.name);
    expect(names).toContain('מיכל שטרן־קוראלניק');
    expect(names).toContain('יוסי ברק');
  });

  it('lets the tenant see only their own months, and never another tenant', async () => {
    const res = await req('GET', '/rent-payments', tenant.token);
    expect(res.statusCode).toBe(200);
    const body = JSON.stringify(res.json());
    expect(body).not.toContain('יוסי ברק');
    expect(body).not.toContain('רן אלמוג');
    const { payments } = res.json();
    expect(payments).toHaveLength(2);
    expect(payments.every((p: { scope: string; propertyId: string }) => p.scope === 'tenant' && p.propertyId === propertyId)).toBe(true);
    expect(payments[0]).not.toHaveProperty('tenant');
  });

  it('filters by property and month range', async () => {
    const res = await req('GET', `/rent-payments?propertyId=${propertyId}&from=2026-09&to=2026-09`, owner.token);
    const { payments } = res.json();
    expect(payments).toHaveLength(1);
    expect(payments[0].month).toBe('2026-09');
    expect(payments[0].paidAgorot).toBe(0);
  });

  it('does not disclose the table to a seeker', async () => {
    const res = await req('GET', '/rent-payments', seeker.token);
    expect(res.statusCode).toBe(200);
    expect(res.json().payments).toEqual([]);
    expect(JSON.stringify(res.json())).not.toContain('מיכל שטרן־קוראלניק');
  });

  it('does not let one owner read another’s roll by guessing an id', async () => {
    const n = `${Date.now()}-x`;
    const stranger = await makeUser('זר', `stranger-${n}@example.com`);
    const res = await req('GET', `/rent-payments?propertyId=${propertyId}`, stranger.token);
    expect(res.json().payments).toEqual([]);
  });
});
