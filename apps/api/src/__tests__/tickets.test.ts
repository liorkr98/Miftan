import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * The maintenance flow, end to end.
 *
 * This is the loop the product lives on — a tenant reports a leak, a
 * tradesperson turns up, a receipt lands, the money shows up in the right
 * column — so it gets tested at the level a user would recognise, not just
 * per-handler.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';

let owner = { id: '', token: '' };
let tenant = { id: '', token: '' };
let stranger = { id: '', token: '' };
let propertyId: string;
let vendorId: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function makeUser(name: string, email: string) {
  const id = newId('user');
  await db.insert(s.users).values({ id, name, email, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

const req = (method: 'GET' | 'POST', url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as object });

beforeEach(async () => {
  owner = await makeUser('רן אלמוג', `owner-${Date.now()}@example.com`);
  tenant = await makeUser('מיכל שטרן', `tenant-${Date.now()}@example.com`);
  stranger = await makeUser('זר', `stranger-${Date.now()}@example.com`);

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

  vendorId = newId('vendor');
  await db.insert(s.vendors).values({
    id: vendorId, ownerId: null, name: 'אבי כהן — אינסטלציה', trade: 'plumber',
    phone: '0546612380', areas: ['תל אביב-יפו'], rating: '4.8',
    calloutFeeAgorot: 28_000, isNetworkPartner: true,
  });
});

async function reportLeak() {
  const res = await req('POST', '/tickets', tenant.token, {
    propertyId,
    category: 'leak',
    severity: 'urgent',
    title: 'נזילה מתחת לכיור במטבח',
    description: 'מאתמול בערב יש שלולית מתחת לארון הכיור.',
    photos: [],
    availability: [new Date(Date.now() + 86_400_000).toISOString()],
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('the whole flow', () => {
  it('goes from a tenant reporting a leak to an expense on the books', async () => {
    const created = await reportLeak();
    expect(created.status).toBe('new');
    expect(created.scope).toBe('tenant');
    /* The opening description becomes the first message, so the thread reads
       as a conversation rather than starting with a reply to nothing. */
    expect(created.messages).toHaveLength(1);

    const id = created.id;
    const act = (action: string, body?: unknown) =>
      req('POST', `/tickets/${id}/actions/${action}`, owner.token, body);

    expect((await act('approve')).json().status).toBe('approved');

    const scheduledAt = new Date(Date.now() + 172_800_000).toISOString();
    const assigned = (await act('assign', { vendorId, scheduledAt })).json();
    expect(assigned.status).toBe('assigned');
    expect(assigned.vendor.name).toBe('אבי כהן — אינסטלציה');

    const confirmed = (await req('POST', `/tickets/${id}/confirm-slot`, tenant.token)).json();
    expect(confirmed.tenantConfirmedSlot).toBe(true);

    expect((await act('start')).json().status).toBe('in_progress');
    expect((await act('request_receipt')).json().status).toBe('awaiting_receipt');

    const closed = (
      await req('POST', `/tickets/${id}/receipt`, tenant.token, { amountAgorot: 28_000, file: null })
    ).json();
    expect(closed.status).toBe('closed');
    expect(closed.receipt.amountAgorot).toBe(28_000);

    /* The payoff: the receipt booked an expense against the unit. */
    const expenses = (await req('GET', '/expenses', owner.token)).json();
    expect(expenses.expenses).toHaveLength(1);
    expect(expenses.expenses[0]).toMatchObject({
      ticketId: id,
      amountAgorot: 28_000,
      category: 'leak',
      kind: 'maintenance',
      vendorName: 'אבי כהן — אינסטלציה',
    });
    expect(expenses.totalAgorot).toBe(28_000);
  });
});

describe('the state machine is enforced on the server', () => {
  it('refuses to skip straight from new to closed', async () => {
    const { id } = await reportLeak();
    const res = await req('POST', `/tickets/${id}/actions/close`, owner.token);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toContain('cannot close a ticket that is "new"');
  });

  it('refuses to book a tradesperson before the ticket is approved', async () => {
    const { id } = await reportLeak();
    const res = await req('POST', `/tickets/${id}/actions/assign`, owner.token, {
      vendorId,
      scheduledAt: new Date().toISOString(),
    });
    expect(res.statusCode).toBe(403);
  });

  it('does not let the tenant approve their own ticket', async () => {
    const { id } = await reportLeak();
    const res = await req('POST', `/tickets/${id}/actions/approve`, tenant.token);
    expect(res.statusCode).toBe(403);
  });

  it('does not let the owner confirm the visit on the tenant behalf', async () => {
    const { id } = await reportLeak();
    await req('POST', `/tickets/${id}/actions/approve`, owner.token);
    await req('POST', `/tickets/${id}/actions/assign`, owner.token, {
      vendorId, scheduledAt: new Date().toISOString(),
    });
    const res = await req('POST', `/tickets/${id}/confirm-slot`, owner.token);
    expect(res.statusCode).toBe(403);
  });

  it('tells the client which actions are legal, from the same table', async () => {
    const created = await reportLeak();
    /* The tenant who opened it can do nothing to its status. */
    expect(created.availableActions).toEqual([]);

    const asOwner = (await req('GET', `/tickets/${created.id}`, owner.token)).json();
    expect(asOwner.availableActions.sort()).toEqual(['approve', 'reject']);
  });

  it('rejecting closes the ticket without an expense', async () => {
    const { id } = await reportLeak();
    expect((await req('POST', `/tickets/${id}/actions/reject`, owner.token)).json().status).toBe('closed');
    expect((await req('GET', '/expenses', owner.token)).json().expenses).toHaveLength(0);
  });

  it('clears the tenant confirmation when the booking changes', async () => {
    const { id } = await reportLeak();
    await req('POST', `/tickets/${id}/actions/approve`, owner.token);
    await req('POST', `/tickets/${id}/actions/assign`, owner.token, {
      vendorId, scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await req('POST', `/tickets/${id}/confirm-slot`, tenant.token);

    /* A different time is a new commitment; the old confirmation should not
       carry over and quietly imply the tenant agreed to it. */
    const reassigned = (
      await req('POST', `/tickets/${id}/actions/assign`, owner.token, {
        vendorId, scheduledAt: new Date(Date.now() + 259_200_000).toISOString(),
      })
    ).json();
    expect(reassigned.tenantConfirmedSlot).toBe(false);
  });
});

describe('receipts', () => {
  async function readyForReceipt() {
    const { id } = await reportLeak();
    await req('POST', `/tickets/${id}/actions/approve`, owner.token);
    await req('POST', `/tickets/${id}/actions/assign`, owner.token, {
      vendorId, scheduledAt: new Date().toISOString(),
    });
    await req('POST', `/tickets/${id}/actions/start`, owner.token);
    return id;
  }

  it('refuses a second receipt on the same ticket', async () => {
    const id = await readyForReceipt();
    await req('POST', `/tickets/${id}/receipt`, owner.token, { amountAgorot: 28_000 });
    const second = await req('POST', `/tickets/${id}/receipt`, owner.token, { amountAgorot: 99_000 });

    expect(second.statusCode).toBe(403);
    expect((await req('GET', '/expenses', owner.token)).json().expenses).toHaveLength(1);
  });

  it('refuses a receipt on a ticket nobody has started', async () => {
    const { id } = await reportLeak();
    const res = await req('POST', `/tickets/${id}/receipt`, owner.token, { amountAgorot: 28_000 });
    expect(res.statusCode).toBe(403);
  });

  it('rejects a negative amount before it reaches the books', async () => {
    const id = await readyForReceipt();
    const res = await req('POST', `/tickets/${id}/receipt`, owner.token, { amountAgorot: -5000 });
    expect(res.statusCode).toBe(422);
  });

  it('closing without a receipt books nothing', async () => {
    const id = await readyForReceipt();
    expect((await req('POST', `/tickets/${id}/actions/close`, owner.token)).json().status).toBe('closed');
    expect((await req('GET', '/expenses', owner.token)).json().expenses).toHaveLength(0);
  });
});

describe('who can see a ticket', () => {
  it('hides it from anyone with no relationship to the property', async () => {
    const { id } = await reportLeak();
    expect((await req('GET', `/tickets/${id}`, stranger.token)).statusCode).toBe(404);
    expect((await req('GET', '/tickets', stranger.token)).json().tickets).toHaveLength(0);
  });

  it('does not let a stranger open a ticket on someone else property', async () => {
    const res = await req('POST', '/tickets', stranger.token, {
      propertyId, category: 'leak', severity: 'low', title: 'not my flat',
    });
    expect(res.statusCode).toBe(404);
  });

  it('shows the owner the commercial terms and the tenant not', async () => {
    const { id } = await reportLeak();
    await req('POST', `/tickets/${id}/actions/approve`, owner.token);
    await req('POST', `/tickets/${id}/actions/assign`, owner.token, {
      vendorId, scheduledAt: new Date().toISOString(),
    });

    const asOwner = (await req('GET', `/tickets/${id}`, owner.token)).json();
    const asTenant = (await req('GET', `/tickets/${id}`, tenant.token)).json();

    expect(asOwner.vendorCalloutFeeAgorot).toBe(28_000);
    expect(asOwner.reportedBy.name).toBe('מיכל שטרן');

    /* The tenant needs to know who is coming and when — not what the owner is
       being charged for it. */
    expect(asTenant.vendor.name).toBe('אבי כהן — אינסטלציה');
    expect(Object.hasOwn(asTenant, 'vendorCalloutFeeAgorot')).toBe(false);
    expect(Object.hasOwn(asTenant, 'expenseId')).toBe(false);
  });

  it('keeps a tenant out of the owner books', async () => {
    const res = await req('GET', '/expenses', tenant.token);
    expect(res.json().expenses).toHaveLength(0);
  });
});

describe('vendor directory', () => {
  it('does not rank network partners above anyone else', async () => {
    await db.insert(s.vendors).values({
      id: newId('vendor'), ownerId: null, name: 'ליאור חשמל', trade: 'electrician',
      phone: '0521108843', areas: ['תל אביב-יפו'], rating: '4.9', isNetworkPartner: false,
    });

    const { vendors } = (await req('GET', '/vendors', owner.token)).json();
    const ratings = vendors.map((v: { rating: number }) => v.rating);

    /* Sorted by rating alone. A partner pays us a commission and is labelled
       as one; it buys them no position. */
    expect(ratings).toEqual([...ratings].sort((a: number, b: number) => b - a));
    expect(vendors[0].isNetworkPartner).toBe(false);
  });
});

describe('messages', () => {
  it('records who said what, in order', async () => {
    const { id } = await reportLeak();
    await req('POST', `/tickets/${id}/messages`, owner.token, { body: 'מאשר, שולח אינסטלטור' });
    await req('POST', `/tickets/${id}/messages`, tenant.token, { body: 'תודה' });

    const thread = (await req('GET', `/tickets/${id}`, tenant.token)).json().messages;
    expect(thread.map((m: { authorRole: string }) => m.authorRole)).toEqual(['tenant', 'owner', 'tenant']);
  });

  it('will not take an empty message', async () => {
    const { id } = await reportLeak();
    expect((await req('POST', `/tickets/${id}/messages`, owner.token, { body: '  ' })).statusCode).toBe(422);
  });
});
