import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { protocolItems } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * פרוטוקול כניסה / יציאה.
 *
 * The protocol only settles a deposit argument if the tenant could see and
 * contest it at the time — so "both parties can write" is a requirement, not a
 * convenience, and it is tested as one.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let tenant = { id: '', token: '' };
let stranger = { id: '', token: '' };
let propertyId: string;

const ELEC = 'pi-elec';
const required = protocolItems.filter((i) => i.required).map((i) => i.id);

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
  stranger = await makeUser('זר', `str-${n}@example.com`);

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

const start = async (kind: 'move_in' | 'move_out') => {
  const res = await req('POST', '/protocols', owner.token, { propertyId, kind });
  expect(res.statusCode).toBe(201);
  return res.json();
};

async function fillRequired(runId: string, token: string, value = '48210') {
  for (const itemId of required) {
    await req('PATCH', `/protocols/${runId}/entries/${itemId}`, token, { done: true, value });
  }
}

describe('running a protocol', () => {
  it('starts from the full checklist, not from whatever rows exist', async () => {
    const run = await start('move_in');
    expect(run.entries).toHaveLength(protocolItems.length);
    expect(run.entries.every((e: { done: boolean }) => !e.done)).toBe(true);
    expect(run.missingRequired.sort()).toEqual([...required].sort());
    expect(run.tenantName).toBe('מיכל שטרן');
  });

  it('lets the tenant record the state of the flat too', async () => {
    const run = await start('move_in');
    /* A tenant who cannot write down that the wall was already cracked gets no
       protection from the protocol at all. */
    const res = await req('PATCH', `/protocols/${run.id}/entries/pi-cond-living`, tenant.token, {
      done: true,
      note: 'סדק בקיר מאחורי הספה, קיים מראש',
      photos: ['https://example.test/a.jpg'],
    });
    expect(res.statusCode).toBe(200);
    const entry = res.json().entries.find((e: { itemId: string }) => e.itemId === 'pi-cond-living');
    expect(entry.note).toContain('סדק');
    expect(entry.photos).toHaveLength(1);
  });

  it('does not wipe fields the caller did not send', async () => {
    const run = await start('move_in');
    await req('PATCH', `/protocols/${run.id}/entries/${ELEC}`, owner.token, {
      done: true, value: '48210', photos: ['https://example.test/meter.jpg'],
    });
    const after = (
      await req('PATCH', `/protocols/${run.id}/entries/${ELEC}`, tenant.token, { note: 'צולם יחד' })
    ).json();

    const entry = after.entries.find((e: { itemId: string }) => e.itemId === ELEC);
    expect(entry.note).toBe('צולם יחד');
    /* The photo the other party attached must survive. */
    expect(entry.photos).toEqual(['https://example.test/meter.jpg']);
    expect(entry.value).toBe('48210');
  });

  it('refuses to close while a required item is unanswered', async () => {
    const run = await start('move_in');
    await req('PATCH', `/protocols/${run.id}/entries/${ELEC}`, owner.token, { done: true, value: '48210' });

    const res = await req('POST', `/protocols/${run.id}/complete`, owner.token);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details.missingRequired.length).toBeGreaterThan(0);
  });

  it('closes once everything required is answered, and then locks', async () => {
    const run = await start('move_in');
    await fillRequired(run.id, owner.token);

    const done = (await req('POST', `/protocols/${run.id}/complete`, owner.token)).json();
    expect(done.completedAt).not.toBeNull();
    expect(done.signed).toBe(true);
    expect(done.missingRequired).toEqual([]);

    /* A signed protocol that can still be edited is not evidence. */
    const late = await req('PATCH', `/protocols/${run.id}/entries/${ELEC}`, owner.token, { value: '99999' });
    expect(late.statusCode).toBe(403);
  });

  it('allows only one open protocol per property', async () => {
    await start('move_in');
    const second = await req('POST', '/protocols', owner.token, { propertyId, kind: 'move_out' });
    expect(second.statusCode).toBe(403);
  });

  it('rejects a checklist item that does not exist', async () => {
    const run = await start('move_in');
    const res = await req('PATCH', `/protocols/${run.id}/entries/pi-nope`, owner.token, { done: true });
    expect(res.statusCode).toBe(404);
  });
});

describe('the comparison', () => {
  it('marks only the rows where both readings exist and differ', async () => {
    const moveIn = await start('move_in');
    await fillRequired(moveIn.id, owner.token, '48210');
    await req('POST', `/protocols/${moveIn.id}/complete`, owner.token);

    const moveOut = await start('move_out');
    await req('PATCH', `/protocols/${moveOut.id}/entries/${ELEC}`, owner.token, { done: true, value: '51044' });
    await req('PATCH', `/protocols/${moveOut.id}/entries/pi-water`, owner.token, { done: true, value: '48210' });

    const cmp = (await req('GET', `/protocols/compare/${propertyId}`, owner.token)).json();
    const byItem = Object.fromEntries(cmp.rows.map((r: { itemId: string }) => [r.itemId, r]));

    expect(byItem[ELEC].moveIn).toBe('48210');
    expect(byItem[ELEC].moveOut).toBe('51044');
    expect(byItem[ELEC].changed).toBe(true);

    /* Same reading both times — nothing to argue about. */
    expect(byItem['pi-water'].changed).toBe(false);

    /* Recorded on the way in but never on the way out: an unanswered question,
       not evidence that anything changed. */
    expect(byItem['pi-cond-living'].moveOut).toBeNull();
    expect(byItem['pi-cond-living'].changed).toBe(false);
  });

  it('is visible to the tenant, who is the other party to it', async () => {
    const moveIn = await start('move_in');
    await req('PATCH', `/protocols/${moveIn.id}/entries/${ELEC}`, owner.token, { done: true, value: '48210' });

    const cmp = await req('GET', `/protocols/compare/${propertyId}`, tenant.token);
    expect(cmp.statusCode).toBe(200);
    expect(cmp.json().moveInRunId).toBe(moveIn.id);
  });
});

describe('who is a party to it', () => {
  it('shuts strangers out of every route', async () => {
    const run = await start('move_in');

    expect((await req('GET', '/protocols', stranger.token)).json().runs).toEqual([]);
    expect((await req('GET', `/protocols/${run.id}`, stranger.token)).statusCode).toBe(404);
    expect((await req('PATCH', `/protocols/${run.id}/entries/${ELEC}`, stranger.token, { done: true })).statusCode).toBe(404);
    expect((await req('POST', `/protocols/${run.id}/complete`, stranger.token)).statusCode).toBe(404);
    expect((await req('GET', `/protocols/compare/${propertyId}`, stranger.token)).statusCode).toBe(404);
  });

  it('does not let a tenant close the protocol on their own flat', async () => {
    const run = await start('move_in');
    await fillRequired(run.id, tenant.token);
    /* They can fill it in; signing it off is the owner's act. */
    expect((await req('POST', `/protocols/${run.id}/complete`, tenant.token)).statusCode).toBe(404);
  });

  it('does not let a tenant open one', async () => {
    const res = await req('POST', '/protocols', tenant.token, { propertyId, kind: 'move_out' });
    expect(res.statusCode).toBe(404);
  });
});
