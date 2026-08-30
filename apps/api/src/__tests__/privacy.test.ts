import type { FastifyInstance } from 'fastify';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * The privacy boundary.
 *
 * The product's whole claim is that a seeker learns a *date* and never a
 * person. These tests exist so that claim survives the next six months of
 * feature work by somebody who has not read this file.
 */

let app: FastifyInstance;

/* Distinctive enough that a substring search over a response body is a
   meaningful test rather than a coincidence generator. */
const TENANT = {
  name: 'מיכל שטרן־קוראלניק',
  email: 'michal.stern.unique@example.com',
  phone: '0521104488',
  password: 'a-long-enough-password',
};
const OWNER = { name: 'רן אלמוג', email: 'ran.almog.unique@example.com', password: 'a-long-enough-password' };
const SEEKER = { name: 'טל אבירם', email: 'tal.aviram.unique@example.com', password: 'a-long-enough-password' };

const NOTES = 'הערה פרטית של בעל הדירה שאסור שתדלוף';

let ownerId: string;
let tenantId: string;
let propertyId: string;
let leaseId: string;
let tokens: { owner: string; tenant: string; seeker: string };

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function makeUser(u: { name: string; email: string; phone?: string; password: string }) {
  const id = newId('user');
  await db.insert(s.users).values({
    id, name: u.name, email: u.email, phone: u.phone ?? null,
    passwordHash: await hashPassword(u.password),
  });
  return id;
}

async function tokenFor(email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
  return res.json().accessToken as string;
}

const auth = (token?: string) => (token ? { authorization: `Bearer ${token}` } : {});
const get = (url: string, token?: string) => app.inject({ method: 'GET', url, headers: auth(token) });

beforeEach(async () => {
  ownerId = await makeUser(OWNER);
  tenantId = await makeUser(TENANT);
  await makeUser(SEEKER);

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId,
    ownerId,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    lat: '32.0651', lng: '34.7708',
    rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000,
    status: 'occupied',
    availableFrom: '2099-07-15',
    availabilityConfidence: 'likely',
    listed: true,
    notes: NOTES,
  });

  leaseId = newId('lease');
  await db.insert(s.leases).values({
    id: leaseId,
    propertyId,
    tenantId,
    startDate: '2025-07-15',
    endDate: '2099-07-15',
    monthlyRentAgorot: 1_040_000,
    depositAgorot: 2_080_000,
    paymentMethod: 'bank_transfer',
    noticePeriodDays: 60,
    /* The private answer the seeker must never reach. */
    renewalIntent: 'too_early',
  });

  tokens = {
    owner: await tokenFor(OWNER.email, OWNER.password),
    tenant: await tokenFor(TENANT.email, TENANT.password),
    seeker: await tokenFor(SEEKER.email, SEEKER.password),
  };
});

/* ── The blunt instrument ──────────────────────────────── */

/**
 * Serialise the whole response and look for anything private in it.
 *
 * Field-by-field assertions only catch leaks somebody thought of. This catches
 * a tenant's name surfacing through a relation added next year, or a debug
 * field, or a nested object nobody remembered was there.
 */
const SECRETS = [TENANT.name, TENANT.email, TENANT.phone, NOTES, 'too_early'];

function assertNoSecrets(body: unknown, where: string) {
  const text = JSON.stringify(body);
  for (const secret of SECRETS) {
    expect(text, `${where} leaked ${JSON.stringify(secret)}`).not.toContain(secret);
  }
}

describe('a seeker never learns who lives there', () => {
  it('leaks nothing through the listing detail', async () => {
    const res = await get(`/properties/${propertyId}`, tokens.seeker);
    expect(res.statusCode).toBe(200);
    assertNoSecrets(res.json(), 'GET /properties/:id as seeker');
  });

  it('leaks nothing through search', async () => {
    const res = await get('/search', tokens.seeker);
    expect(res.statusCode).toBe(200);
    assertNoSecrets(res.json(), 'GET /search as seeker');
  });

  it('leaks nothing to a signed-out stranger', async () => {
    const res = await get(`/properties/${propertyId}`);
    expect(res.statusCode).toBe(200);
    assertNoSecrets(res.json(), 'GET /properties/:id anonymous');
  });

  it('returns a shape with no tenant, lease, notes or status key at all', async () => {
    const body = await get(`/properties/${propertyId}`, tokens.seeker).then((r) => r.json());
    expect(body.scope).toBe('public');
    for (const forbidden of ['tenant', 'lease', 'notes', 'status', 'listed']) {
      expect(Object.hasOwn(body, forbidden), `public view exposed "${forbidden}"`).toBe(false);
    }
  });
});

describe('the private answer becomes a public signal, and only a signal', () => {
  it('publishes a projected date without the intent behind it', async () => {
    const body = await get(`/properties/${propertyId}`, tokens.seeker).then((r) => r.json());
    expect(body.availability).toEqual({
      kind: 'dated',
      date: '2099-07-15',
      confidence: 'likely',
      askable: true,
    });
  });

  it('publishes no date at all when the tenant intends to stay', async () => {
    await db.update(s.leases).set({ renewalIntent: 'extend' }).where(eq(s.leases.id, leaseId));
    const body = await get(`/properties/${propertyId}`, tokens.seeker).then((r) => r.json());

    /* A lease end date the tenant means to renew past is not an availability
       date, and publishing it would be a lie by implication. */
    expect(body.availability.kind).toBe('extending');
    expect(body.availability.date).toBeNull();
  });

  it('publishes no date for an untouched lease nobody has asked about', async () => {
    await db
      .update(s.properties)
      .set({ availabilityConfidence: 'unknown' })
      .where(eq(s.properties.id, propertyId));
    const body = await get(`/properties/${propertyId}`, tokens.seeker).then((r) => r.json());
    expect(body.availability).toMatchObject({ kind: 'unknown', date: null, askable: true });
  });
});

describe('the tenant sees their own lease and their landlord, and no more', () => {
  it('gets lease terms and owner contact', async () => {
    const body = await get(`/properties/${propertyId}`, tokens.tenant).then((r) => r.json());
    expect(body.scope).toBe('tenant');
    expect(body.lease.depositAgorot).toBe(2_080_000);
    expect(body.owner.name).toBe(OWNER.name);
  });

  it('does not get the owner private notes', async () => {
    const body = await get(`/properties/${propertyId}`, tokens.tenant).then((r) => r.json());
    expect(JSON.stringify(body)).not.toContain(NOTES);
    expect(Object.hasOwn(body, 'notes')).toBe(false);
  });
});

describe('the owner sees everything about their own unit', () => {
  it('gets the tenant, the lease and the notes', async () => {
    const body = await get(`/properties/${propertyId}`, tokens.owner).then((r) => r.json());
    expect(body.scope).toBe('owner');
    expect(body.tenant.name).toBe(TENANT.name);
    expect(body.lease.renewalIntent).toBe('too_early');
    expect(body.notes).toBe(NOTES);
  });

  it('sees the public shape when browsing the market', async () => {
    /* Same person, same flat, different question — /search answers "what does
       the market look like", so it answers it the way the market sees it. */
    const body = await get('/search', tokens.owner).then((r) => r.json());
    const own = body.properties.find((p: { id: string }) => p.id === propertyId);
    expect(own.scope).toBe('public');
    assertNoSecrets(body, 'GET /search as owner');
  });
});

describe('scope is per property, not per person', () => {
  it('gives one account owner scope on one unit and public scope on another', async () => {
    const otherOwnerId = await makeUser({ name: 'אחר', email: 'other@example.com', password: 'a-long-enough-password' });
    const otherId = newId('property');
    await db.insert(s.properties).values({
      id: otherId,
      ownerId: otherOwnerId,
      street: 'לבנדה', houseNumber: '14', city: 'תל אביב-יפו', neighborhood: 'פלורנטין',
      lat: '32.0538', lng: '34.7714',
      rooms: '3', sqm: 62, floor: 1, totalFloors: 3,
      monthlyRentAgorot: 840_000, status: 'vacant', listed: true,
    });

    const mine = await get(`/properties/${propertyId}`, tokens.owner).then((r) => r.json());
    const theirs = await get(`/properties/${otherId}`, tokens.owner).then((r) => r.json());

    expect(mine.scope).toBe('owner');
    expect(theirs.scope).toBe('public');
  });

  it('hides an unlisted property from everyone without a relationship', async () => {
    await db.update(s.properties).set({ listed: false }).where(eq(s.properties.id, propertyId));

    const asSeeker = await get(`/properties/${propertyId}`, tokens.seeker);
    const asOwner = await get(`/properties/${propertyId}`, tokens.owner);

    /* 404 rather than 403 — "that exists but is not yours" is a disclosure. */
    expect(asSeeker.statusCode).toBe(404);
    expect(asSeeker.json().error.code).toBe('not_found');
    expect(asOwner.statusCode).toBe(200);
  });

  it('lists only what the viewer owns or rents', async () => {
    const seekerList = await get('/properties', tokens.seeker).then((r) => r.json());
    const ownerList = await get('/properties', tokens.owner).then((r) => r.json());
    const tenantList = await get('/properties', tokens.tenant).then((r) => r.json());

    expect(seekerList.properties).toHaveLength(0);
    expect(ownerList.properties).toHaveLength(1);
    expect(tenantList.properties).toHaveLength(1);
    expect(tenantList.properties[0].scope).toBe('tenant');
  });
});
