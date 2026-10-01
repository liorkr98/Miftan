import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * This version of the product searches Tel Aviv, in nine named areas. The
 * server enforces it: a client that asks for Ramat Gan gets Tel Aviv.
 */

let app: FastifyInstance;
let ownerId: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function unit(city: string, neighborhood: string, street: string) {
  await db.insert(s.properties).values({
    id: newId('property'), ownerId, street, houseNumber: '1', city, neighborhood,
    lat: '32.06', lng: '34.77', rooms: '3', sqm: 70, floor: 2, totalFloors: 4,
    monthlyRentAgorot: 800_000, status: 'vacant', availabilityConfidence: 'confirmed', listed: true,
  });
}

beforeEach(async () => {
  ownerId = newId('user');
  await db.insert(s.users).values({
    id: ownerId, name: 'בעל דירות', email: `geo-${Date.now()}@example.com`, phone: null,
    passwordHash: await hashPassword('a-long-enough-password'),
  });
  await unit('תל אביב-יפו', 'פלורנטין', 'ווליניה');
  await unit('תל אביב-יפו', 'לבונטין', 'לבונטין');
  await unit('תל אביב-יפו', 'הצפון הישן', 'בזל');
  await unit('רמת גן', 'מרכז רמת גן', 'ביאליק');
});

const search = async (filters: Record<string, unknown>) =>
  (
    await app.inject({
      method: 'POST',
      url: '/search',
      payload: { filters: { includeOccupied: true, amenities: [], areas: [], ...filters }, record: false },
    })
  ).json();

describe('search geography', () => {
  it('returns Tel Aviv only, even when nothing narrows it', async () => {
    const res = await search({});
    expect(res.total).toBe(3);
    expect(res.results.every((r: { city: string }) => r.city === 'תל אביב-יפו')).toBe(true);
  });

  it('ignores a request for another city rather than honouring it', async () => {
    const res = await search({ city: 'רמת גן' });
    expect(res.results.some((r: { city: string }) => r.city === 'רמת גן')).toBe(false);
  });

  it('filters by one area, or by several at once', async () => {
    expect((await search({ areas: ['פלורנטין'] })).total).toBe(1);
    const two = await search({ areas: ['פלורנטין', 'לבונטין'] });
    expect(two.results.map((r: { neighborhood: string }) => r.neighborhood).sort()).toEqual(['לבונטין', 'פלורנטין']);
  });

  it('matches nothing, not everything, for an area that is not one of the nine', async () => {
    expect((await search({ areas: ['קריית שלום'] })).total).toBe(0);
  });
});
