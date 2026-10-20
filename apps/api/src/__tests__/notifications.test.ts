import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * The notification feed.
 *
 * Each side hears about its own things, and the privacy lines the rest of the
 * API holds hold here too: the tenant's renewal question never names who
 * asked, and the seeker's reply never carries the tenant's answer.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let tenant = { id: '', token: '' };
let seeker = { id: '', token: '' };
let propertyId: string;

const SEEKER_NAME = 'מחפש-עם-שם-ייחודי';
const TENANT_NOTE = 'הערה-פרטית-של-הדייר';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST', url: string, token: string) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${token}` } });

async function makeUser(name: string, email: string) {
  const id = newId('user');
  await db.insert(s.users).values({ id, name, email, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`);
  tenant = await makeUser('מיכל שטרן', `ten-${n}@example.com`);
  seeker = await makeUser(SEEKER_NAME, `seek-${n}@example.com`);

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'occupied', listed: true,
  });
  await db.insert(s.leases).values({
    id: newId('lease'), propertyId, tenantId: tenant.id,
    startDate: '2025-01-01', endDate: '2099-01-01',
    monthlyRentAgorot: 1_040_000, paymentMethod: 'bank_transfer',
  });
});

describe('GET /notifications', () => {
  it('tells the owner about a new ticket, and the tenant nothing about it yet', async () => {
    await db.insert(s.tickets).values({
      id: newId('ticket'), propertyId, tenantId: tenant.id,
      category: 'leak', severity: 'urgent', status: 'new', title: 'נזילה בתקרה',
    });
    const ownerFeed = (await req('GET', '/notifications', owner.token)).json();
    expect(ownerFeed.items.map((x: { kind: string }) => x.kind)).toContain('ticket_new');
    expect(ownerFeed.unread).toBeGreaterThan(0);

    const tenantFeed = (await req('GET', '/notifications', tenant.token)).json();
    expect(tenantFeed.items.map((x: { kind: string }) => x.kind)).not.toContain('ticket_new');
  });

  it("asks the tenant about their lease without naming who asked", async () => {
    await db.insert(s.availabilityInquiries).values({
      id: newId('inquiry'), propertyId, seekerId: seeker.id,
      message: 'מתי מתפנה?', desiredMoveIn: '2099-06-01', status: 'asked_tenant', askedTenantAt: new Date(),
    });
    const res = await req('GET', '/notifications', tenant.token);
    expect(res.json().items.map((x: { kind: string }) => x.kind)).toContain('renewal_question');
    expect(res.body).not.toContain(SEEKER_NAME);
  });

  it("gives the seeker the owner's reply and never the tenant's answer", async () => {
    await db.insert(s.availabilityInquiries).values({
      id: newId('inquiry'), propertyId, seekerId: seeker.id,
      message: 'מתי מתפנה?', desiredMoveIn: '2099-06-01', status: 'replied',
      tenantAnswer: 'leave', tenantAnswerNote: TENANT_NOTE, tenantAnsweredAt: new Date(),
      ownerReply: 'בסביבות הקיץ', ownerRepliedAt: new Date(), resultingAvailableFrom: '2099-07-01',
    });
    const res = await req('GET', '/notifications', seeker.token);
    const kinds = res.json().items.map((x: { kind: string }) => x.kind);
    expect(kinds).toContain('inquiry_replied');
    expect(res.body).not.toContain(TENANT_NOTE);
    expect(res.body).not.toContain('מיכל');
  });

  it('marks everything read once the bell is opened', async () => {
    await db.insert(s.tickets).values({
      id: newId('ticket'), propertyId, tenantId: tenant.id,
      category: 'lock', severity: 'low', status: 'new', title: 'מנעול תקוע',
    });
    expect((await req('GET', '/notifications', owner.token)).json().unread).toBeGreaterThan(0);
    const seen = await req('POST', '/notifications/seen', owner.token);
    expect(seen.statusCode).toBe(200);
    expect((await req('GET', '/notifications', owner.token)).json().unread).toBe(0);
  });

  it('shows nothing about a unit to someone with no relationship to it', async () => {
    await db.insert(s.tickets).values({
      id: newId('ticket'), propertyId, tenantId: tenant.id,
      category: 'lock', severity: 'low', status: 'new', title: 'מנעול תקוע',
    });
    const stranger = await makeUser('זר', `str-${Date.now()}@example.com`);
    const feed = (await req('GET', '/notifications', stranger.token)).json();
    expect(feed.items).toEqual([]);
  });

  it('requires a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/notifications' });
    expect(res.statusCode).toBe(401);
  });
});
