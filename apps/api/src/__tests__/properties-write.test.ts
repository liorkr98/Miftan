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
    /* The links the upload flow hands back (the local driver, under test). */
    const photos = [
      'http://127.0.0.1:4000/files/properties/44444444-4444-4444-8444-444444444444.jpg',
      'http://127.0.0.1:4000/files/properties/55555555-5555-4555-8555-555555555555.jpg',
    ];
    const res = await req('PUT', `/properties/${id}/photos`, owner.token, { photos });
    expect(res.statusCode).toBe(200);
    expect(res.json().photos).toEqual(photos);
  });

  it('refuses an image hosted anywhere else', async () => {
    const created = await req('POST', '/properties', owner.token, createBody);
    const id = created.json().id as string;
    const res = await req('PUT', `/properties/${id}/photos`, owner.token, {
      photos: ['https://tracker.example/pixel.gif'],
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('what a stranger learns about where a listing is', () => {
  const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const dLat = (a.lat - b.lat) * 111_320;
    const dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng);
  };

  it('by default: the street, no house number, and a pin 100–200 m away', async () => {
    const created = (await req('POST', '/properties', owner.token, { ...createBody, listed: true })).json();
    const seen = (await req('GET', `/properties/${created.id}`, stranger.token)).json();
    expect(seen.scope).toBe('public');
    expect(seen.address.street).toBe(created.address.street);
    expect(seen.address.number).toBe('');
    const off = metresBetween(seen.address, created.address);
    expect(off).toBeGreaterThan(90);
    expect(off).toBeLessThan(210);

    /* The same pin every time, so averaging requests reveals nothing. */
    const again = (await req('GET', `/properties/${created.id}`, stranger.token)).json();
    expect(again.address.lat).toBe(seen.address.lat);
  });

  it('shows the exact address when the owner chooses to', async () => {
    const created = (
      await req('POST', '/properties', owner.token, { ...createBody, listed: true, showExactAddress: true })
    ).json();
    const seen = (await req('GET', `/properties/${created.id}`, stranger.token)).json();
    expect(seen.address.number).toBe(created.address.number);
    expect(seen.address.lat).toBe(created.address.lat);
  });
});
