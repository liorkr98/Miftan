import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { expectedSaving, seasonalTemplates } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * Preventive maintenance.
 *
 * The calendar is a pure function of (templates × your units × the year), so it
 * is materialised on read rather than by a scheduler — nothing to drift, and no
 * cron job to fail silently. The other thing under test is the money: the
 * headline figure has to be an expected value, because an owner shown a number
 * that assumes every skipped task ends in disaster will stop believing all of
 * them.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let stranger = { id: '', token: '' };
let withAc: string;
let withoutAc: string;

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

async function makeProperty(ownerId: string, amenities: string[]) {
  const id = newId('property');
  await db.insert(s.properties).values({
    id, ownerId,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'occupied', amenities,
  });
  return id;
}

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`);
  stranger = await makeUser('זר', `str-${n}@example.com`);
  withAc = await makeProperty(owner.id, ['ac', 'boiler']);
  withoutAc = await makeProperty(owner.id, []);
});

describe('the calendar', () => {
  it('materialises on first read and is stable on the second', async () => {
    const first = (await req('GET', '/seasonal', owner.token)).json();
    expect(first.tasks.length).toBeGreaterThan(0);

    const second = (await req('GET', '/seasonal', owner.token)).json();
    /* Reading twice must not double the calendar. */
    expect(second.tasks.map((t: { id: string }) => t.id).sort()).toEqual(
      first.tasks.map((t: { id: string }) => t.id).sort(),
    );
  });

  it('only schedules work a unit actually has the equipment for', async () => {
    const { tasks } = (await req('GET', '/seasonal', owner.token)).json();
    const acTemplate = seasonalTemplates.find((t) => t.requires_amenity === 'ac')!;

    const onEquipped = tasks.filter(
      (t: { templateId: string; propertyId: string }) =>
        t.templateId === acTemplate.id && t.propertyId === withAc,
    );
    const onBare = tasks.filter(
      (t: { templateId: string; propertyId: string }) =>
        t.templateId === acTemplate.id && t.propertyId === withoutAc,
    );
    expect(onEquipped).toHaveLength(1);
    expect(onBare).toHaveLength(0);
  });

  it('prices the saving as an expected value, not a gross one', async () => {
    const { tasks, outstandingExpectedSaving } = (await req('GET', '/seasonal', owner.token)).json();

    const ac = tasks.find(
      (t: { templateId: string }) => t.templateId === seasonalTemplates.find((x) => x.requires_amenity === 'ac')!.id,
    );
    const template = seasonalTemplates.find((t) => t.id === ac.templateId)!;

    expect(ac.expectedSaving).toBeCloseTo(expectedSaving(template), 5);
    /* The whole point: never the raw avoided cost. */
    expect(ac.expectedSaving).toBeLessThan(template.avoided_cost);
    expect(outstandingExpectedSaving).toBeCloseTo(
      tasks.reduce((sum: number, t: { expectedSaving: number }) => sum + t.expectedSaving, 0),
      5,
    );
  });

  it('stops counting a task towards the saving once it is done', async () => {
    const before = (await req('GET', '/seasonal', owner.token)).json();
    const task = before.tasks[0];

    const done = (await req('POST', `/seasonal/${task.id}/status`, owner.token, { status: 'done' })).json();
    expect(done.status).toBe('done');
    expect(done.completedAt).not.toBeNull();

    const after = (await req('GET', '/seasonal', owner.token)).json();
    expect(after.outstandingExpectedSaving).toBeCloseTo(
      before.outstandingExpectedSaving - task.expectedSaving,
      5,
    );
  });
});

describe('turning it into real work', () => {
  it('creates an ordinary approved ticket with an opening message', async () => {
    const { tasks } = (await req('GET', '/seasonal', owner.token)).json();
    const task = tasks.find((t: { propertyId: string }) => t.propertyId === withAc);

    const scheduled = (await req('POST', `/seasonal/${task.id}/schedule`, owner.token)).json();
    expect(scheduled.status).toBe('scheduled');
    expect(scheduled.ticketId).not.toBeNull();

    const [ticket] = await db.select().from(s.tickets).where(eq(s.tickets.id, scheduled.ticketId));
    /* Preventive work the owner booked is approved by definition. */
    expect(ticket.status).toBe('approved');
    expect(ticket.tenantId).toBeNull();
    expect(ticket.title).toBe(task.title);

    const messages = await db
      .select()
      .from(s.ticketMessages)
      .where(eq(s.ticketMessages.ticketId, scheduled.ticketId));
    expect(messages).toHaveLength(1);
    expect(messages[0].authorRole).toBe('owner');
  });

  it('maps a category the ticket enum does not have onto other, not a wrong trade', async () => {
    const gas = seasonalTemplates.find((t) => t.category === 'gas' || t.category === 'gutters');
    if (!gas) return;

    const { tasks } = (await req('GET', '/seasonal', owner.token)).json();
    const task = tasks.find((t: { templateId: string }) => t.templateId === gas.id);
    if (!task) return;

    const scheduled = (await req('POST', `/seasonal/${task.id}/schedule`, owner.token)).json();
    const [ticket] = await db.select().from(s.tickets).where(eq(s.tickets.id, scheduled.ticketId));
    /* A gas check filed as `boiler` sends a plumber. Vague beats wrong. */
    expect(ticket.category).toBe('other');
  });

  it('refuses to schedule the same task twice', async () => {
    const { tasks } = (await req('GET', '/seasonal', owner.token)).json();
    const task = tasks[0];
    expect((await req('POST', `/seasonal/${task.id}/schedule`, owner.token)).statusCode).toBe(200);
    expect((await req('POST', `/seasonal/${task.id}/schedule`, owner.token)).statusCode).toBe(403);
  });
});

describe('who can see it', () => {
  it('shows a stranger an empty calendar and denies them every task', async () => {
    const { tasks } = (await req('GET', '/seasonal', owner.token)).json();
    const task = tasks[0];

    expect((await req('GET', '/seasonal', stranger.token)).json()).toEqual({
      tasks: [], outstandingExpectedSaving: 0,
    });
    expect((await req('POST', `/seasonal/${task.id}/status`, stranger.token, { status: 'done' })).statusCode).toBe(404);
    expect((await req('POST', `/seasonal/${task.id}/schedule`, stranger.token)).statusCode).toBe(404);
  });
});
