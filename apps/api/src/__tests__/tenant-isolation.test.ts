import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * One flat, three tenancies: the tenant who left, the one living there now,
 * and the one invited to move in next. Each sees their own period and
 * nothing of the others'. The owner sees all of it.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const get = (url: string, token: string) =>
  app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

async function makeUser(name: string) {
  const id = newId('user');
  const email = `${id}@example.com`;
  await db.insert(s.users).values({
    id, name, email, passwordHash: await hashPassword(PASSWORD), emailVerifiedAt: new Date(),
  });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);
const date = (offset: number) => day(offset).toISOString().slice(0, 10);

let owner: { id: string; token: string };
let current: { id: string; token: string };
let next: { id: string; token: string };
let propertyId: string;
const ids = { mine: '', theirs: '', ownerNow: '', previous: '' };

async function lease(tenantId: string, start: number, end: number, rent: number) {
  await db.insert(s.leases).values({
    id: newId('lease'), propertyId, tenantId,
    startDate: date(start), endDate: date(end),
    monthlyRentAgorot: rent, paymentMethod: 'bank_transfer',
  });
}

async function ticket(tenantId: string | null, createdOffset: number, title: string) {
  const id = newId('ticket');
  await db.insert(s.tickets).values({
    id, propertyId, tenantId, category: 'plumbing', severity: 'low', title,
    createdAt: day(createdOffset), updatedAt: day(createdOffset),
  });
  return id;
}

beforeEach(async () => {
  owner = await makeUser('בעלים');
  current = await makeUser('דייר נוכחי');
  next = await makeUser('דייר הבא');
  const previous = await makeUser('דייר קודם');

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'לבנדה', houseNumber: '14', city: 'תל אביב-יפו', neighborhood: 'פלורנטין',
    lat: '32.0565', lng: '34.7700', rooms: '2.5', sqm: 60, floor: 2, totalFloors: 4,
    monthlyRentAgorot: 700_000, status: 'occupied', listed: false,
  });

  await lease(previous.id, -500, -101, 600_000);
  await lease(current.id, -100, 100, 700_000);
  await lease(next.id, 101, 465, 800_000);

  ids.previous = await ticket(previous.id, -200, 'previous tenant leak');
  ids.mine = await ticket(current.id, -5, 'current tenant tap');
  ids.theirs = await ticket(next.id, 0, 'next tenant question');
  ids.ownerNow = await ticket(null, -3, 'owner boiler service');
});

const titles = async (token: string) =>
  ((await get('/tickets', token)).json().tickets as { title: string }[]).map((t) => t.title).sort();

describe('tickets between tenancies', () => {
  it('the owner sees every ticket on the flat', async () => {
    expect(await titles(owner.token)).toHaveLength(4);
  });

  it('the current tenant sees their own and the owner\'s work during their lease', async () => {
    expect(await titles(current.token)).toEqual(['current tenant tap', 'owner boiler service']);
  });

  it('the next tenant sees only their own', async () => {
    expect(await titles(next.token)).toEqual(['next tenant question']);
  });

  it('answers 404 for another tenant\'s ticket, in both directions', async () => {
    expect((await get(`/tickets/${ids.theirs}`, current.token)).statusCode).toBe(404);
    expect((await get(`/tickets/${ids.mine}`, next.token)).statusCode).toBe(404);
    expect((await get(`/tickets/${ids.previous}`, current.token)).statusCode).toBe(404);
  });
});

describe('lease terms between tenancies', () => {
  const rentSeenBy = async (token: string) =>
    (await get(`/properties/${propertyId}`, token)).json().lease?.monthlyRentAgorot;

  it('each tenant reads their own lease, never the other\'s', async () => {
    expect(await rentSeenBy(current.token)).toBe(700_000);
    expect(await rentSeenBy(next.token)).toBe(800_000);
  });

  it('the owner reads the lease in force today', async () => {
    expect(await rentSeenBy(owner.token)).toBe(700_000);
  });
});
