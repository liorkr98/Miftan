import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * The seeker profile is what POST /leads actually reads. These tests exist so
 * the form that writes it and the gate that reads it cannot drift: an
 * incomplete save must not open a queue, and a complete one must.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let user = { id: '', token: '' };
let propertyId = '';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as object });

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const id = newId('user');
  await db.insert(s.users).values({
    id, name: 'טל אבירם', email: `seek-${n}@example.com`, phone: null,
    passwordHash: await hashPassword(PASSWORD),
  });
  const login = await app.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: `seek-${n}@example.com`, password: PASSWORD },
  });
  user = { id, token: login.json().accessToken as string };

  const ownerId = newId('user');
  await db.insert(s.users).values({
    id: ownerId, name: 'רן אלמוג', email: `own-${n}@example.com`,
    passwordHash: await hashPassword(PASSWORD),
  });
  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'vacating', listed: true,
  });
});

const full = {
  name: 'טל אבירם',
  phone: '0501234567',
  incomeToRentRatio: 3.2,
  employment: 'salaried',
  hasGuarantors: true,
  occupants: 2,
  pets: false,
  smoker: false,
  leaseLengthMonths: 12,
  priorLandlordReference: true,
  about: 'זוג, בלי חיות מחמד',
};

describe('GET /me/renter-profile', () => {
  it('returns an incomplete blank rather than 404, so the form can load', async () => {
    const res = await req('GET', '/me/renter-profile', user.token);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.complete).toBe(false);
    expect(body.missing).toEqual(expect.arrayContaining(['phone', 'employment', 'income', 'occupants', 'leaseLength']));
    expect(body.employment).toBeNull();
    expect(body.incomeToRentRatio).toBe(0);
  });
});

describe('PATCH /me/renter-profile', () => {
  it('does not mark complete until the fields a landlord screens on are present', async () => {
    const res = await req('PATCH', '/me/renter-profile', user.token, { pets: true, about: 'hello' });
    expect(res.statusCode).toBe(200);
    expect(res.json().complete).toBe(false);
    expect(res.json().pets).toBe(true);
  });

  it('becomes complete in one save, and that is enough to join a queue', async () => {
    const saved = await req('PATCH', '/me/renter-profile', user.token, full);
    expect(saved.statusCode).toBe(200);
    expect(saved.json().complete).toBe(true);
    expect(saved.json().missing).toEqual([]);
    expect(saved.json().phone).toBe('0501234567');
    expect(saved.json().incomeToRentRatio).toBe(3.2);

    const blocked = await req('POST', '/leads', user.token, {
      propertyId, desiredMoveIn: '2026-12-01', watchOnly: false,
    });
    /* A previous PATCH that left complete=false used to be the only way this
       403 fired for a real account. After a complete save it must not. */
    expect(blocked.statusCode).toBe(201);
  });

  it('refuses a queue join before the profile exists', async () => {
    const res = await req('POST', '/leads', user.token, {
      propertyId, desiredMoveIn: '2026-12-01', watchOnly: false,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('forbidden');
  });

  it('writes name onto the user, not a second copy', async () => {
    await req('PATCH', '/me/renter-profile', user.token, { name: 'טל משה אבירם', phone: '0501234567' });
    const me = await req('GET', '/me', user.token);
    expect(me.json().user.name).toBe('טל משה אבירם');
    expect(me.json().user.phone).toBe('0501234567');
  });
});
