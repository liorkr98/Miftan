import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * An owner's own tradespeople, alongside the network directory.
 *
 * The thing worth guarding here is `ownerId` and `isNetworkPartner`: neither
 * comes from the request body, because the first would let one owner plant a
 * vendor in another's list and the second is a commercial relationship this
 * endpoint has no way to grant.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let other = { id: '', token: '' };

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST' | 'DELETE', url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as object });

async function makeUser(name: string, email: string) {
  const id = newId('user');
  await db.insert(s.users).values({ id, name, email, passwordHash: await hashPassword(PASSWORD), termsAcceptedAt: new Date() });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`);
  other = await makeUser('אורן שגב', `oth-${n}@example.com`);
});

const create = (token: string, over: Record<string, unknown> = {}) =>
  req('POST', '/vendors', token, {
    name: 'אבי כהן — אינסטלציה',
    trade: 'plumber',
    phone: '0546612380',
    areas: ['תל אביב-יפו'],
    calloutFeeAgorot: 28_000,
    ...over,
  });

describe('adding your own tradesperson', () => {
  it('creates one attached to you, never a network partner', async () => {
    const res = await create(owner.token);
    expect(res.statusCode).toBe(201);
    expect(res.json().isNetworkPartner).toBe(false);
    expect(res.json().name).toBe('אבי כהן — אינסטלציה');

    const [row] = await db.select().from(s.vendors).where(eq(s.vendors.id, res.json().id));
    expect(row.ownerId).toBe(owner.id);
  });

  it('ignores an ownerId or isNetworkPartner sent in the body', async () => {
    const res = await create(owner.token, { ownerId: other.id, isNetworkPartner: true });
    const [row] = await db.select().from(s.vendors).where(eq(s.vendors.id, res.json().id));
    expect(row.ownerId).toBe(owner.id);
    expect(row.isNetworkPartner).toBe(false);
  });

  it('shows up in that owner’s /vendors alongside the network', async () => {
    await create(owner.token);
    const list = (await req('GET', '/vendors', owner.token)).json().vendors;
    expect(list.some((v: { name: string }) => v.name === 'אבי כהן — אינסטלציה')).toBe(true);
  });

  it('never appears in another owner’s list', async () => {
    await create(owner.token);
    const list = (await req('GET', '/vendors', other.token)).json().vendors;
    expect(list.some((v: { name: string }) => v.name === 'אבי כהן — אינסטלציה')).toBe(false);
  });

  it('rejects a callout fee with an extra zero', async () => {
    const res = await create(owner.token, { calloutFeeAgorot: 999_999_999 });
    expect(res.statusCode).toBe(422);
  });
});

describe('removing your own tradesperson', () => {
  it('soft-deletes it', async () => {
    const created = (await create(owner.token)).json();
    const res = await req('DELETE', `/vendors/${created.id}`, owner.token);
    expect(res.statusCode).toBe(200);

    const [row] = await db.select().from(s.vendors).where(eq(s.vendors.id, created.id));
    expect(row.deletedAt).not.toBeNull();

    const list = (await req('GET', '/vendors', owner.token)).json().vendors;
    expect(list.some((v: { id: string }) => v.id === created.id)).toBe(false);
  });

  it('refuses to delete another owner’s vendor', async () => {
    const created = (await create(owner.token)).json();
    const res = await req('DELETE', `/vendors/${created.id}`, other.token);
    expect(res.statusCode).toBe(404);

    const [row] = await db
      .select()
      .from(s.vendors)
      .where(and(eq(s.vendors.id, created.id), isNull(s.vendors.deletedAt)));
    expect(row).toBeDefined();
  });
});
