import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { estimateFor, toAgorot } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * Automatic approval of small maintenance spend.
 *
 * This feature commits an owner's money without asking, so the tests are
 * mostly about the limits holding: off by default, a ceiling per job, a cap per
 * month that counts the job about to be added, and a written reason either way.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let tenant = { id: '', token: '' };
let propertyId: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: unknown) =>
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

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'occupied',
  });
  await db.insert(s.leases).values({
    id: newId('lease'), propertyId, tenantId: tenant.id,
    startDate: '2025-01-01', endDate: '2099-01-01',
    monthlyRentAgorot: 1_040_000, paymentMethod: 'bank_transfer',
  });
});

const report = async (over: Record<string, unknown> = {}) => {
  const res = await req('POST', '/tickets', tenant.token, {
    propertyId,
    category: 'lock',
    severity: 'medium',
    title: 'המנעול בדלת הכניסה תקוע',
    description: 'צריך לסובב חזק מאוד כדי לפתוח.',
    photos: [],
    availability: [new Date(Date.now() + 86_400_000).toISOString()],
    ...over,
  });
  expect(res.statusCode).toBe(201);
  return res.json();
};

const enable = (over: Record<string, unknown> = {}) =>
  req('PATCH', '/budget', owner.token, {
    enabled: true,
    perTicketCeilingShekels: 500,
    monthlyCapShekels: 2000,
    categories: ['lock', 'plumbing', 'leak'],
    includeUrgent: false,
    ...over,
  });

describe('off until you turn it on', () => {
  it('starts disabled, with nothing in scope being spent', async () => {
    const policy = (await req('GET', '/budget', owner.token)).json();
    expect(policy.enabled).toBe(false);
    expect(policy.spentThisMonthAgorot).toBe(0);

    const ticket = await report();
    expect(ticket.status).toBe('new');

    const [row] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticket.id));
    expect(row.autoApprovedAt).toBeNull();
    expect(row.autoApprovalReason).toContain('כבוי');
  });
});

describe('when it is on', () => {
  it('approves a small job in scope, and says why', async () => {
    await enable();
    const ticket = await report();
    expect(ticket.status).toBe('approved');

    const [row] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticket.id));
    expect(row.autoApprovedAt).not.toBeNull();
    /* The reason has to be readable by the person who will one day ask why
       their money was committed without them. */
    expect(row.autoApprovalReason).toContain('אושר אוטומטית');
    expect(row.autoApprovalReason).toContain('₪');
    expect(row.estimateAgorot).toBe(estimateFor('lock', 'medium'));
  });

  it('refuses a category the owner did not opt into', async () => {
    await enable({ categories: ['plumbing'] });
    const ticket = await report({ category: 'lock' });
    expect(ticket.status).toBe('new');

    const [row] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticket.id));
    expect(row.autoApprovalReason).toContain('הקטגוריה');
  });

  it('refuses urgent work unless it was explicitly included', async () => {
    await enable();
    const ticket = await report({ severity: 'urgent', category: 'leak' });
    expect(ticket.status).toBe('new');

    const [row] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticket.id));
    expect(row.autoApprovalReason).toContain('דחופות');
  });

  it('refuses a job over the per-ticket ceiling', async () => {
    await enable({ perTicketCeilingShekels: 100 });
    const ticket = await report();
    expect(ticket.status).toBe('new');

    const [row] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticket.id));
    expect(row.autoApprovalReason).toContain('תקרה');
  });
});

describe('the monthly cap', () => {
  it('counts the job about to be added, not only what already went out', async () => {
    /* A lock job estimates at ₪300. A cap of ₪500 has room for one and not
       two — if the cap only looked at what had already been spent, the second
       would slip through at ₪600 total. */
    await enable({ monthlyCapShekels: 500 });

    expect((await report()).status).toBe('approved');
    const second = await report();
    expect(second.status).toBe('new');

    const [row] = await db.select().from(s.tickets).where(eq(s.tickets.id, second.id));
    expect(row.autoApprovalReason).toContain('החודשית');
  });

  it('reports what is left, and never reports a negative', async () => {
    await enable({ monthlyCapShekels: 2000 });
    await report();

    let policy = (await req('GET', '/budget', owner.token)).json();
    expect(policy.autoApprovedThisMonth).toBe(1);
    expect(policy.spentThisMonthAgorot).toBe(estimateFor('lock', 'medium'));
    expect(policy.remainingThisMonthAgorot).toBe(toAgorot(2000) - estimateFor('lock', 'medium'));

    /* Lowering the cap below what has already gone out stops further approvals;
       it does not mean the owner is owed money. */
    await enable({ monthlyCapShekels: 1 });
    policy = (await req('GET', '/budget', owner.token)).json();
    expect(policy.remainingThisMonthAgorot).toBe(0);
    expect((await report()).status).toBe('new');
  });

  it('does not let one owner’s spending consume another’s cap', async () => {
    const other = await makeUser('אורן שגב', `other-${Date.now()}@example.com`);
    const otherProperty = newId('property');
    await db.insert(s.properties).values({
      id: otherProperty, ownerId: other.id,
      street: 'בזל', houseNumber: '8', city: 'תל אביב-יפו', neighborhood: 'הצפון הישן',
      lat: '32.0897', lng: '34.7812', rooms: '2.5', sqm: 55, floor: 1, totalFloors: 3,
      monthlyRentAgorot: 810_000, status: 'occupied',
    });

    await enable({ monthlyCapShekels: 500 });
    await report();

    const mine = (await req('GET', '/budget', owner.token)).json();
    const theirs = (await req('GET', '/budget', other.token)).json();
    expect(mine.spentThisMonthAgorot).toBeGreaterThan(0);
    expect(theirs.spentThisMonthAgorot).toBe(0);
  });
});

describe('the settings themselves', () => {
  it('takes shekels and stores agorot', async () => {
    await enable({ perTicketCeilingShekels: 750, monthlyCapShekels: 3000 });
    const policy = (await req('GET', '/budget', owner.token)).json();
    expect(policy.perTicketCeilingAgorot).toBe(75_000);
    expect(policy.monthlyCapAgorot).toBe(300_000);
  });

  it('refuses an extra zero', async () => {
    /* The failure this feature must not have. */
    const res = await req('PATCH', '/budget', owner.token, { perTicketCeilingShekels: 5_000_000 });
    expect(res.statusCode).toBe(422);
  });

  it('leaves untouched fields alone', async () => {
    await enable({ categories: ['lock'], perTicketCeilingShekels: 400 });
    await req('PATCH', '/budget', owner.token, { enabled: false });

    const policy = (await req('GET', '/budget', owner.token)).json();
    expect(policy.enabled).toBe(false);
    expect(policy.categories).toEqual(['lock']);
    expect(policy.perTicketCeilingAgorot).toBe(40_000);
  });
});
