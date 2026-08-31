import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CRITERIA } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';
import { eq } from 'drizzle-orm';

const eqUser = (id: string) => eq(s.renterProfiles.userId, id);
const eqProperty = (id: string) => eq(s.properties.id, id);
const eqPreset = (id: string) => eq(s.screeningPresets.id, id);

/**
 * Queues, screening and the audit trail.
 *
 * Two things are being protected here. The first is a seeker's privacy: the
 * other applicants for a flat are not their business, and no lead endpoint may
 * leak a name, a phone or a salary ratio to them. The second is the owner's
 * position if a rejected applicant ever challenges them — which means the audit
 * log has to record the rule as it stood at the time, not as it stands now.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';

let owner = { id: '', token: '' };
let alice = { id: '', token: '' };
let bob = { id: '', token: '' };
let propertyId: string;
let presetId: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as object });

async function makeUser(name: string, email: string, phone: string) {
  const id = newId('user');
  await db.insert(s.users).values({ id, name, email, phone, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

async function giveProfile(userId: string, over: Partial<typeof s.renterProfiles.$inferInsert> = {}) {
  await db.insert(s.renterProfiles).values({
    userId,
    incomeToRentRatio: '3.60',
    employment: 'salaried_permanent',
    hasGuarantors: true,
    occupants: 2,
    pets: false,
    smoker: false,
    leaseLengthMonths: 12,
    priorLandlordReference: true,
    about: 'זוג צעיר, ללא חיות מחמד',
    complete: true,
    ...over,
  });
}

const soon = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `owner-${n}@example.com`, '0521112222');
  alice = await makeUser('מיכל שטרן', `alice-${n}@example.com`, '0543334444');
  bob = await makeUser('יוסי ברק', `bob-${n}@example.com`, '0505556666');

  await Promise.all([giveProfile(alice.id), giveProfile(bob.id, { incomeToRentRatio: '2.10', hasGuarantors: false })]);

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'vacant', listed: true, availableFrom: soon(),
  });

  presetId = newId('screeningPreset');
  await db.insert(s.screeningPresets).values({
    id: presetId, ownerId: owner.id, name: 'ברירת מחדל',
    criteria: DEFAULT_CRITERIA, isActive: true,
  });
});

async function queueUp(who: typeof alice, watchOnly = false) {
  const res = await req('POST', '/leads', who.token, { propertyId, desiredMoveIn: soon(), watchOnly });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('joining a queue', () => {
  it('places you at the back and tells you how long the line is', async () => {
    const first = await queueUp(alice);
    expect(first.scope).toBe('seeker');
    expect(first.queuePosition).toBe(1);

    const second = await queueUp(bob);
    expect(second.queuePosition).toBe(2);

    const mine = (await req('GET', '/leads', bob.token)).json();
    expect(mine.leads).toHaveLength(1);
    expect(mine.leads[0].queueLength).toBe(2);
  });

  it('freezes the profile at application time, so later edits do not rewrite history', async () => {
    const lead = await queueUp(alice);
    await db
      .update(s.renterProfiles)
      .set({ incomeToRentRatio: '9.99' })
      .where(eqUser(alice.id));

    const seen = (await req('GET', `/leads/${lead.id}`, owner.token)).json();
    expect(seen.screening.incomeToRentRatio).toBe(3.6);
  });

  it('refuses a second place in the same queue', async () => {
    await queueUp(alice);
    const again = await req('POST', '/leads', alice.token, { propertyId, desiredMoveIn: soon(), watchOnly: false });
    expect(again.statusCode).toBe(403);
  });

  it('refuses an incomplete renter profile rather than screening on blanks', async () => {
    const drifter = await makeUser('נדב', `drifter-${Date.now()}@example.com`, '0501234567');
    await giveProfile(drifter.id, { complete: false });
    const res = await req('POST', '/leads', drifter.token, { propertyId, desiredMoveIn: soon(), watchOnly: false });
    expect(res.statusCode).toBe(403);
  });

  it('refuses a listing that was never published', async () => {
    await db.update(s.properties).set({ listed: false }).where(eqProperty(propertyId));
    const res = await req('POST', '/leads', alice.token, { propertyId, desiredMoveIn: soon(), watchOnly: false });
    expect(res.statusCode).toBe(404);
  });

  it('closes the gap behind someone who leaves', async () => {
    const a = await queueUp(alice);
    await queueUp(bob);
    expect((await req('DELETE', `/leads/${a.id}`, alice.token)).statusCode).toBe(200);

    const left = (await req('GET', '/leads', bob.token)).json();
    expect(left.leads[0].queuePosition).toBe(1);
    expect(left.leads[0].queueLength).toBe(1);
  });
});

describe('what each side is allowed to see', () => {
  it('gives the owner the applicant, the snapshot and a score', async () => {
    await queueUp(alice);
    const list = (await req('GET', '/leads', owner.token)).json();

    expect(list.leads).toHaveLength(1);
    const lead = list.leads[0];
    expect(lead.scope).toBe('owner');
    expect(lead.seeker.name).toBe('מיכל שטרן');
    expect(lead.about).toBe('זוג צעיר, ללא חיות מחמד');
    expect(lead.flags.length).toBeGreaterThan(0);
    expect(lead.score).toBeGreaterThan(0);
  });

  it('never lets a seeker see another applicant, by any field', async () => {
    await queueUp(alice);
    await queueUp(bob);

    for (const url of ['/leads', `/leads/${(await req('GET', '/leads', bob.token)).json().leads[0].id}`]) {
      const res = await req('GET', url, bob.token);
      expect(res.statusCode).toBe(200);
      /* Scan the whole body rather than asserting field by field: a widened
         response schema should fail this, not slip through it. */
      const body = res.body;
      expect(body).not.toContain('מיכל שטרן');
      expect(body).not.toContain('0543334444');
      expect(body).not.toContain('screening');
      expect(body).not.toContain('flags');
    }
  });

  it('shows a stranger nothing and denies them a lead by id', async () => {
    const lead = await queueUp(alice);
    const stranger = await makeUser('זר', `stranger-${Date.now()}@example.com`, '0509998888');

    expect((await req('GET', '/leads', stranger.token)).json().leads).toEqual([]);
    expect((await req('GET', `/leads/${lead.id}`, stranger.token)).statusCode).toBe(404);
    expect((await req('POST', `/leads/${lead.id}/stage`, stranger.token, { stage: 'rejected' })).statusCode).toBe(404);
  });

  it('does not hand the owner a seeker row for a queue they are also in', async () => {
    /* An owner can queue for someone else's flat; they should not then see
       their own application twice. */
    await giveProfile(owner.id);
    const other = newId('property');
    await db.insert(s.properties).values({
      id: other, ownerId: alice.id,
      street: 'דיזנגוף', houseNumber: '1', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
      lat: '32.07', lng: '34.77', rooms: '2', sqm: 45, floor: 1, totalFloors: 4,
      monthlyRentAgorot: 700_000, status: 'vacant', listed: true,
    });
    await req('POST', '/leads', owner.token, { propertyId: other, desiredMoveIn: soon(), watchOnly: false });
    await queueUp(bob);

    const list = (await req('GET', '/leads', owner.token)).json();
    expect(list.leads).toHaveLength(2);
    expect(list.leads.filter((l: { scope: string }) => l.scope === 'owner')).toHaveLength(1);
    expect(list.leads.filter((l: { scope: string }) => l.scope === 'seeker')).toHaveLength(1);
  });
});

describe('screening and the audit trail', () => {
  it('scores a weaker application lower without hiding it', async () => {
    await queueUp(alice);
    await queueUp(bob);

    const list = (await req('GET', '/leads', owner.token)).json();
    const byName = Object.fromEntries(
      list.leads.map((l: { seeker: { name: string }; score: number }) => [l.seeker.name, l.score]),
    );
    /* Bob fails income and guarantors. He ranks lower and stays on the list —
       a failed criterion is a reason, not a filter. */
    expect(byName['יוסי ברק']).toBeLessThan(byName['מיכל שטרן']);
    expect(list.leads).toHaveLength(2);
  });

  it('records the rule as it stood when the decision was made', async () => {
    const lead = await queueUp(bob);

    const moved = (await req('POST', `/leads/${lead.id}/stage`, owner.token, { stage: 'rejected' })).json();
    expect(moved.stage).toBe('rejected');

    const audit = (await req('GET', '/screening/audit', owner.token)).json();
    expect(audit.total).toBe(1);
    const [entry] = audit.entries;
    expect(entry.action).toBe('stage_changed');
    expect(entry.leadName).toBe('יוסי ברק');
    expect(entry.presetName).toBe('ברירת מחדל');
    expect(entry.detail).toContain('rejected');
    expect(entry.propertyLabel).toBe('נחלת בנימין 55');
    const income = entry.flags.find((f: { criterion: string }) => f.criterion === 'income_to_rent');
    expect(income.passed).toBe(false);

    /* Now relax the rule. Today's list changes; the record of what happened
       yesterday does not. */
    await req('PATCH', `/screening/presets/${presetId}`, owner.token, {
      criteria: DEFAULT_CRITERIA.map((c) => (c.id === 'income_to_rent' ? { ...c, value: 1 } : c)),
    });

    const nowFlags = (await req('GET', `/leads/${lead.id}`, owner.token)).json().flags;
    expect(nowFlags.find((f: { criterion: string }) => f.criterion === 'income_to_rent').passed).toBe(true);

    const auditAfter = (await req('GET', '/screening/audit', owner.token)).json();
    expect(
      auditAfter.entries[0].flags.find((f: { criterion: string }) => f.criterion === 'income_to_rent').passed,
    ).toBe(false);
  });

  it('keeps one preset active at a time and logs the switch', async () => {
    const second = newId('screeningPreset');
    await db.insert(s.screeningPresets).values({
      id: second, ownerId: owner.id, name: 'מחמיר',
      criteria: DEFAULT_CRITERIA, isActive: false,
    });

    const after = (await req('POST', `/screening/presets/${second}/activate`, owner.token)).json();
    expect(after.presets.filter((p: { isActive: boolean }) => p.isActive)).toHaveLength(1);
    expect(after.presets.find((p: { id: string }) => p.id === second).isActive).toBe(true);

    const audit = (await req('GET', '/screening/audit', owner.token)).json();
    expect(audit.entries[0].action).toBe('preset_applied');
    expect(audit.entries[0].propertyLabel).toBeNull();
  });

  it('keeps one owner out of another owner’s presets and audit', async () => {
    const lead = await queueUp(alice);
    await req('POST', `/leads/${lead.id}/stage`, owner.token, { stage: 'screening' });

    expect((await req('GET', '/screening/audit', alice.token)).json()).toEqual({ entries: [], total: 0 });
    expect((await req('GET', '/screening/presets', alice.token)).json().presets).toEqual([]);
    expect((await req('PATCH', `/screening/presets/${presetId}`, alice.token, { name: 'שלי' })).statusCode).toBe(404);
    expect((await req('POST', `/screening/presets/${presetId}/activate`, alice.token)).statusCode).toBe(404);
  });

  it('screens against an empty rule set rather than crashing when there is no preset', async () => {
    await db.update(s.screeningPresets).set({ isActive: false }).where(eqPreset(presetId));
    await queueUp(alice);

    const list = (await req('GET', '/leads', owner.token)).json();
    expect(list.leads[0].flags).toEqual([]);
    expect(list.leads[0].score).toBe(0);
  });
});
