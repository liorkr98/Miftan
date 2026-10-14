import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { DEFAULT_CRITERIA, israelToday, zonedWallTime } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';
import { sentMail } from '../email/index.ts';

/**
 * The owner's portfolio views, and the calendar's owner-side moves: what the
 * activity page and the property calendar are built on.
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

type Who = { id: string; token: string };
const req = (method: 'GET' | 'POST', url: string, who: Who, payload?: unknown) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${who.token}` }, payload: payload as object });

async function makeUser(name: string): Promise<Who> {
  const id = newId('user');
  await db.insert(s.users).values({ id, name, email: `${name}-${id}@example.com`, phone: '0501234567', passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: `${name}-${id}@example.com`, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

const day = (offset: number) => {
  const d = new Date(`${israelToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

let owner: Who;
let stranger: Who;
let propertyId: string;

async function makeLead(seeker: Who, o: { watch?: boolean; ratio?: string; createdDaysAgo?: number } = {}) {
  const id = newId('lead');
  await db.insert(s.leads).values({
    id, propertyId, seekerId: seeker.id, stage: 'new', desiredMoveIn: day(10), queuePosition: 1,
    watchOnly: Boolean(o.watch), incomeToRentRatio: o.ratio ?? '4.00', employment: 'salaried', hasGuarantors: true,
    occupants: 1, pets: false, smoker: false, leaseLengthMonths: 12,
    createdAt: new Date(Date.now() - (o.createdDaysAgo ?? 1) * 86_400_000),
  });
  return id;
}

async function makeSlot(offsetDays: number, hhmm: string, lead?: string) {
  const id = newId('viewingSlot');
  await db.insert(s.viewingSlots).values({
    id, propertyId, ownerId: owner.id, startsAt: zonedWallTime(day(offsetDays), hhmm), durationMinutes: 15,
    status: lead ? 'booked' : 'open', leadId: lead ?? null, bookedAt: lead ? new Date() : null,
  });
  return id;
}

beforeEach(async () => {
  owner = await makeUser('owner');
  stranger = await makeUser('stranger');
  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id, street: 'פלורנטין', houseNumber: '16', city: 'תל אביב-יפו',
    neighborhood: 'פלורנטין', lat: '32.05', lng: '34.77', rooms: '2', sqm: 50, floor: 1, totalFloors: 3,
    monthlyRentAgorot: 650_000, status: 'vacant', listed: true, availabilityConfidence: 'confirmed',
  });
  /* The owner's own bar — "relevant" means clearing it. */
  await db.insert(s.screeningPresets).values({ id: newId('screeningPreset'), ownerId: owner.id, name: 'ברירת מחדל', criteria: DEFAULT_CRITERIA, isActive: true });
  sentMail.length = 0;
});

describe('snapshot', () => {
  it('counts applicants, relevance, alerts and the week ahead — by name, for the owner only', async () => {
    const strong = await makeUser('מאיה לוי');
    const weak = await makeUser('weak');
    const watcher = await makeUser('watcher');
    const strongLead = await makeLead(strong);
    await makeLead(weak, { ratio: '1.50' });
    await makeLead(watcher, { watch: true });
    await makeSlot(1, '17:30', strongLead);
    await makeSlot(1, '17:45');
    await db.insert(s.listingViews).values([
      { id: newId('listingView'), propertyId, viewerKey: 'a:1', day: day(0) },
      { id: newId('listingView'), propertyId, viewerKey: 'a:2', day: day(-1) },
      { id: newId('listingView'), propertyId, viewerKey: 'a:3', day: day(-9) },
    ]);

    const snap = (await req('GET', '/portfolio/snapshot', owner)).json();
    const p = snap.properties.find((x: { propertyId: string }) => x.propertyId === propertyId);
    expect(p).toMatchObject({ applicants: 2, relevant: 1, relevantWithoutViewing: 0, alerts: 1, upcomingViewings: 1, openSlots: 1, views7d: 2, viewsPrev7d: 1 });
    expect(snap.agenda).toHaveLength(1);
    expect(snap.agenda[0]).toMatchObject({ kind: 'viewing', personName: 'מאיה לוי', propertyLabel: 'פלורנטין 16' });

    /* Somebody else's portfolio is empty, not an error. */
    const theirs = (await req('GET', '/portfolio/snapshot', stranger)).json();
    expect(theirs.properties).toEqual([]);
  });
});

describe('analytics', () => {
  it('zero-fills the series and counts the funnel inside the period', async () => {
    const a = await makeUser('a');
    await makeLead(a, { createdDaysAgo: 2 });
    await makeLead(await makeUser('old'), { createdDaysAgo: 40 });
    await db.insert(s.listingViews).values([
      { id: newId('listingView'), propertyId, viewerKey: 'a:1', day: day(-1) },
      { id: newId('listingView'), propertyId, viewerKey: 'a:1', day: day(-2) },
      { id: newId('listingView'), propertyId, viewerKey: 'a:2', day: day(-2) },
    ]);

    const res = (await req('GET', `/portfolio/analytics?from=${day(-6)}&to=${day(0)}`, owner)).json();
    const p = res.properties.find((x: { propertyId: string }) => x.propertyId === propertyId);
    expect(p.daily).toHaveLength(7);
    expect(p.daily.find((d: { date: string }) => d.date === day(-2)).views).toBe(2);
    expect(p.funnel).toMatchObject({ views: 3, uniqueViewers: 2, applications: 1, relevant: 1 });
  });

  it('refuses a reversed range', async () => {
    const res = await req('GET', `/portfolio/analytics?from=${day(0)}&to=${day(-3)}`, owner);
    expect(res.statusCode).toBe(422);
  });
});

describe('the owner calendar', () => {
  it('moves a booked viewing in one step, freeing the old time and telling the applicant', async () => {
    const seeker = await makeUser('seeker');
    const lead = await makeLead(seeker);
    const from = await makeSlot(1, '18:00', lead);
    const to = await makeSlot(1, '18:30');

    const res = await req('POST', `/viewings/${from}/move`, owner, { toSlotId: to });
    expect(res.statusCode).toBe(200);
    const [a] = await db.select().from(s.viewingSlots).where(eq(s.viewingSlots.id, from));
    const [b] = await db.select().from(s.viewingSlots).where(eq(s.viewingSlots.id, to));
    expect(a.status).toBe('open');
    expect(a.leadId).toBeNull();
    expect(b).toMatchObject({ status: 'booked', leadId: lead });
    expect(sentMail.some((m) => m.subject.includes('הוזזה'))).toBe(true);
  });

  it('will not move onto a time somebody else holds', async () => {
    const lead1 = await makeLead(await makeUser('one'));
    const lead2 = await makeLead(await makeUser('two'));
    const from = await makeSlot(1, '18:00', lead1);
    const taken = await makeSlot(1, '18:15', lead2);

    const res = await req('POST', `/viewings/${from}/move`, owner, { toSlotId: taken });
    expect(res.statusCode).toBe(403);
    const [a] = await db.select().from(s.viewingSlots).where(eq(s.viewingSlots.id, from));
    expect(a).toMatchObject({ status: 'booked', leadId: lead1 });
  });

  it('cancels and keeps the time free, or withdraws it', async () => {
    const reopened = await makeSlot(2, '18:00', await makeLead(await makeUser('r')));
    const withdrawn = await makeSlot(2, '18:15', await makeLead(await makeUser('w')));

    expect((await req('POST', `/viewings/${reopened}/cancel`, owner, { reopen: true })).statusCode).toBe(200);
    expect((await req('POST', `/viewings/${withdrawn}/cancel`, owner, {})).statusCode).toBe(200);
    const [r] = await db.select().from(s.viewingSlots).where(eq(s.viewingSlots.id, reopened));
    const [w] = await db.select().from(s.viewingSlots).where(eq(s.viewingSlots.id, withdrawn));
    expect(r).toMatchObject({ status: 'open', leadId: null });
    expect(w.status).toBe('cancelled');
    expect(sentMail.filter((m) => m.subject.includes('בוטלה'))).toHaveLength(2);
  });

  it('does not let a stranger move anything', async () => {
    const from = await makeSlot(1, '18:00', await makeLead(await makeUser('x')));
    const to = await makeSlot(1, '18:30');
    expect((await req('POST', `/viewings/${from}/move`, stranger, { toSlotId: to })).statusCode).toBe(404);
  });
});
