import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { REVIEW_WINDOW_DAYS } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * Reviews after a tenancy.
 *
 * The tests are mostly about the two rules that make this survivable: nothing
 * before the tenancy is over, and neither side reads the other's until both
 * have written or the window runs out. Get the second wrong and the feature
 * becomes a retaliation channel; make the seal absolute and it becomes a veto
 * for whichever side simply never replies.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let tenant = { id: '', token: '' };
let stranger = { id: '', token: '' };
let propertyId: string;
let endedLease: string;
let liveLease: string;

const OWNER_TEXT = 'שמרה על הדירה יפה, שילמה בזמן, ותקשורת נעימה לאורך כל התקופה.';
const TENANT_TEXT = 'ענה מהר על תקלות, החזיר את הפיקדון במלואו ובזמן. הייתי שוכרת ממנו שוב.';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST', url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as object });

async function makeUser(name: string, email: string) {
  const id = newId('user');
  await db.insert(s.users).values({ id, name, email, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`);
  tenant = await makeUser('מיכל שטרן', `ten-${n}@example.com`);
  stranger = await makeUser('זר', `str-${n}@example.com`);

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    district: 'tel_aviv',
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'vacant',
  });

  endedLease = newId('lease');
  await db.insert(s.leases).values({
    id: endedLease, propertyId, tenantId: tenant.id,
    startDate: day(-800), endDate: day(-30),
    monthlyRentAgorot: 1_040_000, paymentMethod: 'bank_transfer',
  });

  /* A second, still-running tenancy on the same flat, to prove the gate is on
     the tenancy and not on the person. */
  liveLease = newId('lease');
  await db.insert(s.leases).values({
    id: liveLease, propertyId, tenantId: tenant.id,
    startDate: day(-20), endDate: day(340),
    monthlyRentAgorot: 1_100_000, paymentMethod: 'bank_transfer',
  });
});

const write = (who: typeof owner, leaseId: string, body: string, rating = 5) =>
  req('POST', '/reviews', who.token, { leaseId, rating, communication: 5, reliability: 4, body });

describe('when a review may be written', () => {
  it('refuses one while the tenancy is still running', async () => {
    const res = await write(owner, liveLease, OWNER_TEXT);
    expect(res.statusCode).toBe(403);
  });

  it('accepts one once it has ended', async () => {
    const res = await write(owner, endedLease, OWNER_TEXT);
    expect(res.statusCode).toBe(201);
    expect(res.json().authorRole).toBe('owner');
    expect(res.json().propertyLabel).toBe('נחלת בנימין 55');
    expect(res.json().tenancyUntil).toBe(day(-30));
  });

  it('refuses a second from the same side', async () => {
    await write(owner, endedLease, OWNER_TEXT);
    const again = await write(owner, endedLease, 'ניסיון שני לכתוב על אותה שכירות בדיוק.');
    expect(again.statusCode).toBe(403);
  });

  it('refuses someone who was not party to it', async () => {
    const res = await write(stranger, endedLease, OWNER_TEXT);
    expect(res.statusCode).toBe(404);
  });

  it('refuses a one-word review', async () => {
    const res = await req('POST', '/reviews', owner.token, {
      leaseId: endedLease, rating: 1, body: 'רע',
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('the seal', () => {
  it('hides a lone review from the person it is about', async () => {
    await write(owner, endedLease, OWNER_TEXT);

    /* The tenant must not be able to read it before writing their own —
       otherwise they are answering it, not describing a tenancy. */
    const asTenant = (await req('GET', `/reviews?userId=${tenant.id}`, tenant.token)).json();
    expect(asTenant.about).toEqual([]);
    expect(asTenant.reviewCount).toBe(0);

    const body = (await req('GET', `/reviews?userId=${tenant.id}`, tenant.token)).body;
    expect(body).not.toContain(OWNER_TEXT);
  });

  it('still shows an author their own sealed review', async () => {
    await write(owner, endedLease, OWNER_TEXT);
    const mine = (await req('GET', '/reviews', owner.token)).json().mine;
    expect(mine).toHaveLength(1);
    expect(mine[0].published).toBe(false);
    expect(mine[0].sealedUntil).not.toBeNull();
    expect(mine[0].body).toBe(OWNER_TEXT);
  });

  it('releases both the moment the pair completes', async () => {
    await write(owner, endedLease, OWNER_TEXT);
    await write(tenant, endedLease, TENANT_TEXT);

    const aboutTenant = (await req('GET', `/reviews?userId=${tenant.id}`, tenant.token)).json();
    const aboutOwner = (await req('GET', `/reviews?userId=${owner.id}`, owner.token)).json();

    expect(aboutTenant.about).toHaveLength(1);
    expect(aboutTenant.about[0].body).toBe(OWNER_TEXT);
    expect(aboutOwner.about).toHaveLength(1);
    expect(aboutOwner.about[0].body).toBe(TENANT_TEXT);
  });

  it('lifts on its own when the other side never writes', async () => {
    await write(owner, endedLease, OWNER_TEXT);

    /* Backdate past the window. Without this release, a landlord could silence
       a review simply by never replying — the seal would be a veto. */
    await db
      .update(s.reviews)
      .set({ createdAt: sql`now() - interval '${sql.raw(String(REVIEW_WINDOW_DAYS + 1))} days'` })
      .where(eq(s.reviews.leaseId, endedLease));

    const about = (await req('GET', `/reviews?userId=${tenant.id}`, tenant.token)).json();
    expect(about.about).toHaveLength(1);
    expect(about.about[0].body).toBe(OWNER_TEXT);
  });
});

describe('what gets shown', () => {
  it('withholds an average until three reviews stand behind it', async () => {
    await write(owner, endedLease, OWNER_TEXT, 4);
    await write(tenant, endedLease, TENANT_TEXT, 5);

    const about = (await req('GET', `/reviews?userId=${tenant.id}`, tenant.token)).json();
    expect(about.reviewCount).toBe(1);
    /* One review plus an average is a number that identifies its author. */
    expect(about.averageRating).toBeNull();
  });

  it('names the tenancy each review describes', async () => {
    await write(owner, endedLease, OWNER_TEXT);
    await write(tenant, endedLease, TENANT_TEXT);

    const about = (await req('GET', `/reviews?userId=${owner.id}`, owner.token)).json().about[0];
    /* A reader has to be able to see it was a real tenancy of real length. */
    expect(about.tenancyFrom).toBe(day(-800));
    expect(about.tenancyUntil).toBe(day(-30));
    expect(about.authorName).toBe('מיכל שטרן');
    expect(about.authorRole).toBe('tenant');
  });
});

describe('the pending list', () => {
  it('offers the ended tenancy to both sides and drops it once written', async () => {
    const forOwner = (await req('GET', '/reviews', owner.token)).json().pending;
    expect(forOwner).toHaveLength(1);
    expect(forOwner[0].leaseId).toBe(endedLease);
    expect(forOwner[0].myRole).toBe('owner');
    expect(forOwner[0].counterpartName).toBe('מיכל שטרן');

    const forTenant = (await req('GET', '/reviews', tenant.token)).json().pending;
    expect(forTenant[0].myRole).toBe('tenant');
    expect(forTenant[0].counterpartName).toBe('רן אלמוג');

    await write(owner, endedLease, OWNER_TEXT);
    expect((await req('GET', '/reviews', owner.token)).json().pending).toEqual([]);
    /* The tenant's invitation is untouched by the owner having written. */
    expect((await req('GET', '/reviews', tenant.token)).json().pending).toHaveLength(1);
  });

  it('does not offer a tenancy that is still running', async () => {
    const pending = (await req('GET', '/reviews', owner.token)).json().pending;
    expect(pending.map((p: { leaseId: string }) => p.leaseId)).not.toContain(liveLease);
  });

  it('gives a deadline fixed to the tenancy, not to today', async () => {
    const [p] = (await req('GET', '/reviews', owner.token)).json().pending;
    /* 90 days after the tenancy ended, which for a lease that ended 30 days
       ago is 60 days out — not 90. */
    const expected = new Date(new Date(day(-30)).getTime() + 90 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(p.writeBy).toBe(expected);
  });

  it('stops offering a tenancy nobody is going to review any more', async () => {
    const old = newId('lease');
    await db.insert(s.leases).values({
      id: old, propertyId, tenantId: stranger.id,
      startDate: day(-1200), endDate: day(-400),
      monthlyRentAgorot: 900_000, paymentMethod: 'bank_transfer',
    });

    const pending = (await req('GET', '/reviews', owner.token)).json().pending;
    expect(pending.map((p: { leaseId: string }) => p.leaseId)).not.toContain(old);
  });
});
