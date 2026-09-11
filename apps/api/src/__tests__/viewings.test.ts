import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { DEFAULT_CRITERIA } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * Viewings.
 *
 * Two things carry this feature. The screening gate has to be a gate and not a
 * wall — the owner can always put someone through it, and the override is
 * recorded rather than silent. And two applicants tapping the same time at the
 * same moment must not both get it.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let strong = { id: '', token: '' };
let weak = { id: '', token: '' };
let propertyId: string;
let strongLead: string;
let weakLead: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const req = (method: 'GET' | 'POST', url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as object });

async function makeUser(name: string, email: string, phone: string) {
  const id = newId('user');
  await db.insert(s.users).values({ id, name, email, phone, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function makeLead(seekerId: string, position: number, over: Record<string, unknown> = {}) {
  const id = newId('lead');
  await db.insert(s.leads).values({
    id, propertyId, seekerId, stage: 'new', desiredMoveIn: soon(60), queuePosition: position,
    incomeToRentRatio: '4.50', employment: 'salaried', hasGuarantors: true,
    occupants: 2, pets: false, smoker: false, leaseLengthMonths: 24, priorLandlordReference: true,
    ...over,
  });
  return id;
}

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`, '0521112222');
  strong = await makeUser('מיכל שטרן', `strong-${n}@example.com`, '0543334444');
  weak = await makeUser('עידן מזרחי', `weak-${n}@example.com`, '0505556666');

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    district: 'tel_aviv',
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'vacant', listed: true,
  });

  await db.insert(s.screeningPresets).values({
    id: newId('screeningPreset'), ownerId: owner.id, name: 'ברירת מחדל',
    criteria: DEFAULT_CRITERIA, isActive: true,
  });

  strongLead = await makeLead(strong.id, 1);
  /* Fails income and guarantors against the default preset. */
  weakLead = await makeLead(weak.id, 2, { incomeToRentRatio: '1.80', hasGuarantors: false });
});

const publish = (over: Record<string, unknown> = {}) =>
  req('POST', '/viewings', owner.token, {
    propertyId, date: soon(3), from: '16:00', until: '17:00',
    durationMinutes: 15, gapMinutes: 5, ...over,
  });

describe('publishing times', () => {
  it('turns a window into slots on the given rhythm', async () => {
    const res = await publish();
    expect(res.statusCode).toBe(201);
    /* 16:00–17:00 at 15+5 minutes: 16:00, 16:20, 16:40. 17:00 would end at
       17:15, past the window. */
    expect(res.json().slots).toHaveLength(3);
    expect(res.json().slots[0].scope).toBe('owner');
    expect(res.json().slots[0].durationMinutes).toBe(15);
  });

  it('does not double the schedule when the same afternoon is published twice', async () => {
    await publish();
    const again = await publish();
    expect(again.json().slots).toHaveLength(3);
  });

  it('refuses a window that ends before it starts, or is too short for one viewing', async () => {
    expect((await publish({ from: '17:00', until: '16:00' })).statusCode).toBe(422);
    expect((await publish({ from: '16:00', until: '16:10' })).statusCode).toBe(422);
  });

  it('is not something an applicant can do', async () => {
    const res = await req('POST', '/viewings', strong.token, {
      propertyId, date: soon(3), from: '16:00', until: '17:00',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('the screening gate', () => {
  it('lets an applicant who cleared the filters take a time', async () => {
    await publish();
    const schedule = (await req('GET', `/viewings/${propertyId}`, strong.token)).json();
    expect(schedule.eligible).toBe(true);

    const booked = (
      await req('POST', `/viewings/${schedule.slots[0].id}/book`, strong.token, { leadId: strongLead })
    ).json();
    expect(booked.scope).toBe('seeker');
    expect(booked.mine).toBe(true);
    expect(booked.taken).toBe(true);

    /* Booking moves them along the pipeline. */
    const [lead] = await db.select().from(s.leads).where(eq(s.leads.id, strongLead));
    expect(lead.stage).toBe('viewing_scheduled');
  });

  it('turns away one who did not, and says which criterion', async () => {
    await publish();
    const schedule = (await req('GET', `/viewings/${propertyId}`, weak.token)).json();
    expect(schedule.eligible).toBe(false);
    /* A refusal with no reason is the worst version of this screen. */
    expect(schedule.ineligibleReason).toBeTruthy();
    expect(schedule.ineligibleReason.length).toBeGreaterThan(5);

    const res = await req('POST', `/viewings/${schedule.slots[0].id}/book`, weak.token, { leadId: weakLead });
    expect(res.statusCode).toBe(403);
  });

  it('lets the owner invite them anyway, and records that they did', async () => {
    const slots = (await publish()).json().slots;

    /* Without the flag it refuses, so the override cannot be a click-through. */
    const blocked = await req('POST', `/viewings/${slots[0].id}/invite`, owner.token, { leadId: weakLead });
    expect(blocked.statusCode).toBe(422);

    const invited = (
      await req('POST', `/viewings/${slots[0].id}/invite`, owner.token, {
        leadId: weakLead, overrideScreening: true, note: 'הגיע דרך המלצה',
      })
    ).json();
    expect(invited.invitedByOwner).toBe(true);
    expect(invited.applicant.name).toBe('עידן מזרחי');
    expect(invited.note).toBe('הגיע דרך המלצה');
  });

  it('does not mark an eligible applicant as an override', async () => {
    const slots = (await publish()).json().slots;
    const invited = (
      await req('POST', `/viewings/${slots[0].id}/invite`, owner.token, {
        leadId: strongLead, overrideScreening: true,
      })
    ).json();
    /* They cleared the filters; the flag would be a false record. */
    expect(invited.invitedByOwner).toBe(false);
  });
});

describe('who sees what', () => {
  it('never shows an applicant who holds the other times', async () => {
    const slots = (await publish()).json().slots;
    await req('POST', `/viewings/${slots[0].id}/book`, strong.token, { leadId: strongLead });

    const body = (await req('GET', `/viewings/${propertyId}`, weak.token)).body;
    /* Knowing who else is coming turns a viewing into an auction before
       anybody has applied. */
    expect(body).not.toContain('מיכל שטרן');
    expect(body).not.toContain('0543334444');
    expect(body).not.toContain('applicant');

    const seen = JSON.parse(body).slots;
    expect(seen[0].taken).toBe(true);
    expect(seen[0].mine).toBe(false);
  });

  it('shows the owner the whole schedule with names', async () => {
    const slots = (await publish()).json().slots;
    await req('POST', `/viewings/${slots[0].id}/book`, strong.token, { leadId: strongLead });

    const schedule = (await req('GET', `/viewings/${propertyId}`, owner.token)).json();
    expect(schedule.slots[0].applicant.name).toBe('מיכל שטרן');
    expect(schedule.slots[1].applicant).toBeNull();
  });

  it('keeps someone who is not in the queue out entirely', async () => {
    await publish();
    const stranger = await makeUser('זר', `str-${Date.now()}@example.com`, '0509998888');
    expect((await req('GET', `/viewings/${propertyId}`, stranger.token)).statusCode).toBe(404);
  });
});

describe('changing your mind', () => {
  it('reopens the time when an applicant gives it back', async () => {
    const slots = (await publish()).json().slots;
    await req('POST', `/viewings/${slots[0].id}/book`, strong.token, { leadId: strongLead });

    const released = (await req('POST', `/viewings/${slots[0].id}/cancel`, strong.token)).json();
    expect(released.taken).toBe(false);

    const asOwner = (await req('GET', `/viewings/${propertyId}`, owner.token)).json();
    expect(asOwner.slots[0].status).toBe('open');
    expect(asOwner.slots[0].applicant).toBeNull();
  });

  it('withdraws the time entirely when the owner cancels it', async () => {
    const slots = (await publish()).json().slots;
    const cancelled = (await req('POST', `/viewings/${slots[0].id}/cancel`, owner.token)).json();
    expect(cancelled.status).toBe('cancelled');
  });

  it('refuses a time somebody already holds', async () => {
    const slots = (await publish()).json().slots;
    await req('POST', `/viewings/${slots[0].id}/book`, strong.token, { leadId: strongLead });

    /* A second applicant who would otherwise be allowed. The refusal has to be
       about the slot being gone, not about them. */
    const rival = await makeUser('נועם בר', `rival-${Date.now()}@example.com`, '0507776666');
    const rivalLead = await makeLead(rival.id, 3);

    const res = await req('POST', `/viewings/${slots[0].id}/book`, rival.token, { leadId: rivalLead });
    expect(res.statusCode).toBe(403);

    /* And the slot still belongs to whoever took it first. */
    const schedule = (await req('GET', `/viewings/${propertyId}`, owner.token)).json();
    expect(schedule.slots[0].applicant.name).toBe('מיכל שטרן');
  });
});

describe('the briefing before the viewing', () => {
  it('hands the owner the person they are about to meet', async () => {
    const slots = (await publish({ date: soon(0), from: '23:00', until: '23:30' })).json().slots;
    await req('POST', `/viewings/${slots[0].id}/invite`, owner.token, { leadId: strongLead });

    const { briefings } = (await req('GET', '/viewings/upcoming/briefings?withinHours=48', owner.token)).json();
    expect(briefings).toHaveLength(1);

    const b = briefings[0];
    expect(b.applicant.name).toBe('מיכל שטרן');
    expect(b.applicant.phone).toBe('0543334444');
    expect(b.propertyLabel).toBe('נחלת בנימין 55');
    expect(b.queuePosition).toBe(1);
    expect(b.screening.incomeToRentRatio).toBe(4.5);
    /* Scored against the preset as it stands now, not as it stood at
       application — the owner is about to make a decision today. */
    expect(b.flags.length).toBeGreaterThan(0);
    expect(b.score).toBeGreaterThan(0);
  });

  it('does not brief an owner on somebody else’s viewing', async () => {
    const slots = (await publish({ date: soon(0), from: '23:00', until: '23:30' })).json().slots;
    await req('POST', `/viewings/${slots[0].id}/invite`, owner.token, { leadId: strongLead });

    const other = await makeUser('אורן שגב', `oth-${Date.now()}@example.com`, '0501112233');
    const { briefings } = (await req('GET', '/viewings/upcoming/briefings', other.token)).json();
    expect(briefings).toEqual([]);
  });
});

describe('attendance', () => {
  it('moves an applicant to viewed when they turn up', async () => {
    const slots = (await publish()).json().slots;
    await req('POST', `/viewings/${slots[0].id}/book`, strong.token, { leadId: strongLead });

    const done = (
      await req('POST', `/viewings/${slots[0].id}/attendance`, owner.token, { status: 'attended' })
    ).json();
    expect(done.status).toBe('attended');

    const [lead] = await db.select().from(s.leads).where(eq(s.leads.id, strongLead));
    expect(lead.stage).toBe('viewed');
  });

  it('does not move them backwards for a no-show', async () => {
    const slots = (await publish()).json().slots;
    await req('POST', `/viewings/${slots[0].id}/book`, strong.token, { leadId: strongLead });
    await req('POST', `/viewings/${slots[0].id}/attendance`, owner.token, { status: 'no_show' });

    const [lead] = await db.select().from(s.leads).where(eq(s.leads.id, strongLead));
    /* Rejecting them is the owner's call, not a rule. */
    expect(lead.stage).toBe('viewing_scheduled');
  });
});
