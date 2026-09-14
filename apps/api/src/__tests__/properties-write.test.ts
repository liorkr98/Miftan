import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { toAgorot } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';
import { eq } from 'drizzle-orm';

/**
 * Creating and editing a unit. A first landlord cannot onboard without POST,
 * and listed/rent/notes were previously a read-only badge on a screen that
 * already knew they should be writable.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let stranger = { id: '', token: '' };

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as object });

async function makeUser(name: string, email: string) {
  const id = newId('user');
  await db.insert(s.users).values({ id, name, email, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

const createBody = {
  street: 'נחלת בנימין',
  houseNumber: '12',
  city: 'תל אביב-יפו',
  neighborhood: 'לב העיר',
  rooms: 3,
  sqm: 72,
  floor: 4,
  totalFloors: 6,
  amenities: ['elevator', 'parking'],
  monthlyRentShekels: 7200,
  arnonaBimonthlyShekels: 640,
  vaadMonthlyShekels: 180,
  status: 'vacant' as const,
};

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`);
  stranger = await makeUser('זר', `stranger-${n}@example.com`);
});

describe('POST /properties', () => {
  it('takes shekels, stores agorot, and derives the district from the city', async () => {
    const res = await req('POST', '/properties', owner.token, createBody);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.scope).toBe('owner');
    expect(body.listed).toBe(false);
    expect(body.monthlyRentAgorot).toBe(toAgorot(7200));
    expect(body.address.city).toBe('תל אביב-יפו');
    expect(body.address.lat).toBeCloseTo(32.0853, 3);

    const [row] = await db.select().from(s.properties).where(eq(s.properties.id, body.id));
    expect(row.district).toBe('tel_aviv');
    expect(row.ownerId).toBe(owner.id);
  });

  it('refuses a floor above the building', async () => {
    const res = await req('POST', '/properties', owner.token, { ...createBody, floor: 9, totalFloors: 4 });
    expect(res.statusCode).toBe(422);
  });
});

describe('PATCH /properties/:id', () => {
  it('lets the owner toggle listed and change the rent', async () => {
    const created = await req('POST', '/properties', owner.token, createBody);
    const id = created.json().id as string;

    const res = await req('PATCH', `/properties/${id}`, owner.token, {
      listed: true,
      monthlyRentShekels: 7800,
      notes: 'משופצת, כניסה מיידית',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().listed).toBe(true);
    expect(res.json().monthlyRentAgorot).toBe(toAgorot(7800));
    expect(res.json().notes).toBe('משופצת, כניסה מיידית');
  });

  it('404s rather than 403s for anyone who does not own it', async () => {
    const created = await req('POST', '/properties', owner.token, createBody);
    const id = created.json().id as string;
    const res = await req('PATCH', `/properties/${id}`, stranger.token, { listed: true });
    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /properties/:id/photos', () => {
  it('replaces the whole array, because order is the cover', async () => {
    const created = await req('POST', '/properties', owner.token, createBody);
    const id = created.json().id as string;
    const photos = [
      'https://uploads.example.com/cover.jpg',
      'https://uploads.example.com/kitchen.jpg',
    ];
    const res = await req('PUT', `/properties/${id}/photos`, owner.token, { photos });
    expect(res.statusCode).toBe(200);
    expect(res.json().photos).toEqual(photos);
  });
});
