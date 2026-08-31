import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * Message threads.
 *
 * The thing worth testing is that "the other person" and "unread" are both
 * answered from the reader's point of view. Get either wrong and the landlord
 * sees a mailbox addressed to themselves, or a badge that never clears.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let tenant = { id: '', token: '' };
let stranger = { id: '', token: '' };
let propertyId: string;

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
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'occupied',
  });
});

const openThread = async (over: Record<string, unknown> = {}) => {
  const res = await req('POST', '/threads', owner.token, {
    subject: 'חידוש חוזה',
    body: 'שלום מיכל, רציתי לדבר על חידוש החוזה.',
    counterpartyRole: 'tenant',
    counterpartyUserId: tenant.id,
    propertyId,
    ...over,
  });
  expect(res.statusCode).toBe(201);
  return res.json();
};

describe('a conversation', () => {
  it('shows each side the other person, not themselves', async () => {
    const thread = await openThread();
    expect(thread.counterpartyName).toBe('מיכל שטרן');
    expect(thread.counterpartyRole).toBe('tenant');
    expect(thread.propertyLabel).toBe('נחלת בנימין 55');

    const theirs = (await req('GET', `/threads/${thread.id}`, tenant.token)).json();
    expect(theirs.counterpartyName).toBe('רן אלמוג');
    expect(theirs.counterpartyRole).toBe('owner');
  });

  it('counts unread from the reader’s side and never your own messages', async () => {
    const thread = await openThread();
    /* The owner wrote the opener, so it is not news to them. */
    expect(thread.unread).toBe(0);

    const forTenant = (await req('GET', '/threads', tenant.token)).json();
    expect(forTenant.totalUnread).toBe(1);
    expect(forTenant.threads[0].unread).toBe(1);

    await req('POST', `/threads/${thread.id}/read`, tenant.token);
    expect((await req('GET', '/threads', tenant.token)).json().totalUnread).toBe(0);

    /* Reading does not touch the other side's count. */
    const back = (await req('POST', `/threads/${thread.id}/messages`, tenant.token, {
      body: 'שלום רן, בוא נדבר בשבוע הבא.',
    })).json();
    expect(back.messages).toHaveLength(2);
    expect((await req('GET', '/threads', owner.token)).json().totalUnread).toBe(1);
  });

  it('marks authorship from the reader’s point of view', async () => {
    const thread = await openThread();
    await req('POST', `/threads/${thread.id}/messages`, tenant.token, { body: 'בסדר גמור' });

    const asOwner = (await req('GET', `/threads/${thread.id}`, owner.token)).json().messages;
    expect(asOwner.map((m: { mine: boolean }) => m.mine)).toEqual([true, false]);

    const asTenant = (await req('GET', `/threads/${thread.id}`, tenant.token)).json().messages;
    expect(asTenant.map((m: { mine: boolean }) => m.mine)).toEqual([false, true]);
  });

  it('sorts the mailbox by activity, so a reply moves a thread up', async () => {
    const first = await openThread({ subject: 'ראשון' });
    await openThread({ subject: 'שני' });

    let list = (await req('GET', '/threads', owner.token)).json().threads;
    expect(list[0].subject).toBe('שני');

    await req('POST', `/threads/${first.id}/messages`, tenant.token, { body: 'עדכון' });
    list = (await req('GET', '/threads', owner.token)).json().threads;
    expect(list[0].subject).toBe('ראשון');
  });

  it('does not put message bodies in the list', async () => {
    await openThread();
    const list = (await req('GET', '/threads', owner.token)).json().threads;
    expect(list[0].messages).toBeUndefined();
    /* A preview, though, is what makes a mailbox readable. */
    expect(list[0].lastMessage).toContain('חידוש');
  });
});

describe('counterparties without an account', () => {
  it('takes a plain name for someone who has no login', async () => {
    const thread = await openThread({
      counterpartyRole: 'vendor',
      counterpartyUserId: null,
      counterpartyName: 'אבי כהן — אינסטלציה',
      subject: 'נזילה בקומה 3',
    });
    expect(thread.counterpartyName).toBe('אבי כהן — אינסטלציה');
  });

  it('refuses a counterparty with neither an account nor a name', async () => {
    const res = await req('POST', '/threads', owner.token, {
      subject: 'בלי שם', body: 'שלום', counterpartyRole: 'vendor',
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('who can read it', () => {
  it('keeps strangers out of every route', async () => {
    const thread = await openThread();
    expect((await req('GET', '/threads', stranger.token)).json().threads).toEqual([]);
    expect((await req('GET', `/threads/${thread.id}`, stranger.token)).statusCode).toBe(404);
    expect((await req('POST', `/threads/${thread.id}/messages`, stranger.token, { body: 'היי' })).statusCode).toBe(404);
    expect((await req('POST', `/threads/${thread.id}/read`, stranger.token)).statusCode).toBe(404);
  });

  it('refuses to attach a thread to a property you do not own', async () => {
    const res = await req('POST', '/threads', tenant.token, {
      subject: 'שלי', body: 'שלום', counterpartyRole: 'tenant', propertyId,
    });
    expect(res.statusCode).toBe(404);
  });
});
