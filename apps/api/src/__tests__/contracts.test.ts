import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * Contract scanning.
 *
 * One rule carries the whole surface: the scan proposes, the owner commits.
 * The tests that matter are the ones proving a scan on its own changes nothing,
 * and that a field the owner did not confirm is not written.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let tenant = { id: '', token: '' };
let stranger = { id: '', token: '' };
let propertyId: string;
let leaseId: string;

/* A plausible Israeli residential lease, in the shape these actually arrive. */
const CONTRACT = `
חוזה שכירות בלתי מוגנת

בין: רן אלמוג, ת.ז. 000000000 (להלן "המשכיר")
לבין: מיכל שטרן, ת.ז. 111111111 (להלן "השוכר")

1. הנכס: דירה בת 3 חדרים ברחוב נחלת בנימין 55, תל אביב-יפו.

2. תקופת השכירות: תקופת השכירות תחל ביום 01/09/2026
   ותסתיים ביום 31/08/2027.

3. דמי השכירות: השוכר ישלם דמי שכירות חודשיים בסך
   ₪8,400 (שמונת אלפים וארבע מאות שקלים חדשים).

4. פיקדון: השוכר יפקיד בידי המשכיר ערבון בסך 16,800 ש"ח.

5. הודעה מוקדמת: כל צד רשאי להביא חוזה זה לידי סיום בהודעה מוקדמת
   של 60 ימים מראש ובכתב.

6. אופציה: לשוכר תינתן אופציה להארכת החוזה ב־12 חודשים נוספים.
`;

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

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`);
  tenant = await makeUser('מיכל שטרן', `ten-${n}@example.com`);
  stranger = await makeUser('זר', `str-${n}@example.com`);

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    lat: '32.0651', lng: '34.7708', rooms: '3', sqm: 62, floor: 1, totalFloors: 3,
    monthlyRentAgorot: 700_000, status: 'occupied',
  });
  leaseId = newId('lease');
  await db.insert(s.leases).values({
    id: leaseId, propertyId, tenantId: tenant.id,
    startDate: '2025-01-01', endDate: '2026-01-01',
    monthlyRentAgorot: 700_000, paymentMethod: 'bank_transfer',
  });
});

const scan = async (text = CONTRACT) => {
  const res = await req('POST', '/contracts', owner.token, {
    propertyId, fileName: 'חוזה-נחלת-בנימין-55.pdf', text,
  });
  expect(res.statusCode).toBe(201);
  return res.json();
};

const valueOf = (result: { fields: Array<{ key: string; value: string }> }, key: string) =>
  result.fields.find((f) => f.key === key)?.value;

describe('reading a contract', () => {
  it('finds the terms an owner would type in by hand', async () => {
    const result = await scan();
    expect(result.status).toBe('review');

    expect(valueOf(result, 'monthlyRent')).toBe('8400');
    expect(valueOf(result, 'deposit')).toBe('16800');
    expect(valueOf(result, 'startDate')).toBe('2026-09-01');
    expect(valueOf(result, 'endDate')).toBe('2027-08-31');
    expect(valueOf(result, 'noticePeriodDays')).toBe('60');
    expect(valueOf(result, 'extensionMonths')).toBe('12');
  });

  it('quotes the line it read each value from', async () => {
    const result = await scan();
    const rent = result.fields.find((f: { key: string }) => f.key === 'monthlyRent');
    /* Without this the owner is being asked to trust a number with no way to
       check it against the paper in their hand. */
    expect(rent.sourceHint).toContain('דמי השכירות');
    expect(rent.confidence).toBeGreaterThan(0);
    expect(rent.confidence).toBeLessThanOrEqual(1);
  });

  it('says what it could not find rather than guessing', async () => {
    const result = await scan('חוזה שכירות. הנכס: דירה ברחוב הרצל 88.');
    expect(result.missing).toContain('monthlyRent');
    expect(result.missing).toContain('startDate');
    expect(result.fields).toEqual([]);
  });

  it('changes nothing on its own', async () => {
    await scan();
    /* The entire point. A scan is a reading, not an edit. */
    const [lease] = await db.select().from(s.leases).where(eq(s.leases.id, leaseId));
    expect(lease.monthlyRentAgorot).toBe(700_000);
    expect(lease.startDate).toBe('2025-01-01');

    const [property] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
    expect(property.monthlyRentAgorot).toBe(700_000);
  });
});

describe('committing what the owner approved', () => {
  it('writes the confirmed values to the lease and the unit', async () => {
    const result = await scan();
    const committed = (
      await req('POST', `/contracts/${result.id}/commit`, owner.token, {
        monthlyRent: 8400,
        deposit: 16800,
        startDate: '2026-09-01',
        endDate: '2027-08-31',
        noticePeriodDays: 60,
        extensionMonths: 12,
      })
    ).json();
    expect(committed.status).toBe('committed');
    expect(committed.committedAt).not.toBeNull();

    const [lease] = await db.select().from(s.leases).where(eq(s.leases.id, leaseId));
    expect(lease.monthlyRentAgorot).toBe(840_000);
    expect(lease.depositAgorot).toBe(1_680_000);
    expect(lease.startDate).toBe('2026-09-01');
    expect(lease.noticePeriodDays).toBe(60);
    expect(lease.hasExtensionOption).toBe(true);

    /* A lease that disagrees with its unit is a broken rent roll. */
    const [property] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
    expect(property.monthlyRentAgorot).toBe(840_000);
  });

  it('writes only what was sent — silence is not consent', async () => {
    const result = await scan();
    await req('POST', `/contracts/${result.id}/commit`, owner.token, { monthlyRent: 8400 });

    const [lease] = await db.select().from(s.leases).where(eq(s.leases.id, leaseId));
    expect(lease.monthlyRentAgorot).toBe(840_000);
    /* The scan found these too. The owner did not confirm them. */
    expect(lease.startDate).toBe('2025-01-01');
    expect(lease.depositAgorot).toBe(0);
  });

  it('takes the owner’s correction over what it read', async () => {
    const result = await scan();
    expect(valueOf(result, 'monthlyRent')).toBe('8400');

    /* The scan misread it, or the parties agreed something else. The body is
       the source of truth, not the extraction. */
    await req('POST', `/contracts/${result.id}/commit`, owner.token, { monthlyRent: 9100 });
    const [lease] = await db.select().from(s.leases).where(eq(s.leases.id, leaseId));
    expect(lease.monthlyRentAgorot).toBe(910_000);
  });

  it('refuses an empty approval and a second one', async () => {
    const result = await scan();
    expect((await req('POST', `/contracts/${result.id}/commit`, owner.token, {})).statusCode).toBe(422);

    await req('POST', `/contracts/${result.id}/commit`, owner.token, { monthlyRent: 8400 });
    expect(
      (await req('POST', `/contracts/${result.id}/commit`, owner.token, { monthlyRent: 9999 })).statusCode,
    ).toBe(403);
  });
});

describe('who can scan', () => {
  it('keeps a tenant and a stranger out entirely', async () => {
    const result = await scan();

    for (const who of [tenant, stranger]) {
      expect((await req('GET', '/contracts', who.token)).json().scans).toEqual([]);
      expect((await req('GET', `/contracts/${result.id}`, who.token)).statusCode).toBe(404);
      expect(
        (await req('POST', `/contracts/${result.id}/commit`, who.token, { monthlyRent: 1 })).statusCode,
      ).toBe(404);
      expect(
        (await req('POST', '/contracts', who.token, { propertyId, fileName: 'x.pdf', text: CONTRACT })).statusCode,
      ).toBe(404);
    }
  });
});
