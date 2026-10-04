import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * A listing shows how many people opened it and how many asked to be told
 * when it frees up. Both are counts: no response names a viewer or a watcher.
 */

let app: FastifyInstance;
let propertyId: string;
const PASSWORD = 'a-long-enough-password';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function makeUser(name: string) {
  const id = newId('user');
  const email = `${name}-${id}@example.com`;
  await db.insert(s.users).values({ id, name, email, phone: null, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

const auth = (token?: string) => (token ? { authorization: `Bearer ${token}` } : {});
const view = (token?: string, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url: `/properties/${propertyId}/views`, headers: { ...auth(token), ...headers } });
const read = async () => (await app.inject({ method: 'GET', url: `/properties/${propertyId}` })).json();

let owner: { id: string; token: string };

beforeEach(async () => {
  owner = await makeUser('owner');
  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id, street: 'ווליניה', houseNumber: '3', city: 'תל אביב-יפו',
    neighborhood: 'פלורנטין', lat: '32.05', lng: '34.76', rooms: '2', sqm: 48, floor: 2, totalFloors: 4,
    monthlyRentAgorot: 720_000, status: 'vacant', availabilityConfidence: 'confirmed', listed: true,
  });
});

describe('listing views', () => {
  it('counts a viewer once a day, however often they open it', async () => {
    const seeker = await makeUser('seeker');
    expect((await view(seeker.token)).statusCode).toBe(204);
    await view(seeker.token);
    await view(seeker.token);
    expect((await read()).viewCount).toBe(1);
  });

  it('counts different anonymous browsers separately', async () => {
    await view(undefined, { 'user-agent': 'phone-a' });
    await view(undefined, { 'user-agent': 'phone-b' });
    await view(undefined, { 'user-agent': 'phone-a' });
    expect((await read()).viewCount).toBe(2);
  });

  it('does not count the owner looking at their own flat', async () => {
    await view(owner.token);
    expect((await read()).viewCount).toBe(0);
  });

  it('refuses an unpublished listing', async () => {
    await db.update(s.properties).set({ listed: false });
    expect((await view()).statusCode).toBe(404);
  });

  it('reports how many people asked to be notified, and never who', async () => {
    for (const name of ['w1', 'w2']) {
      const u = await makeUser(name);
      await db.insert(s.leads).values({
        id: newId('lead'), propertyId, seekerId: u.id, stage: 'new', desiredMoveIn: '2027-01-01',
        queuePosition: 0, watchOnly: true, incomeToRentRatio: '3', employment: 'salaried',
        hasGuarantors: true, occupants: 1, pets: false, smoker: false, leaseLengthMonths: 12,
        priorLandlordReference: true,
      });
    }
    const body = await read();
    expect(body.watchCount).toBe(2);
    expect(JSON.stringify(body)).not.toMatch(/w1-|w2-|seekerId|viewerKey/);
  });
});
