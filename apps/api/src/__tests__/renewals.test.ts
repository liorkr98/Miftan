import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { israelToday } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';
import { sentMail } from '../email/index.ts';

/**
 * Lease turnover, end to end: the lease opens its own renewal, the tenant
 * answers in one tap, and everything that follows — signing, or the search for
 * the next tenant — runs from that answer.
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

async function makeUser(name: string): Promise<Who & { email: string }> {
  const id = newId('user');
  const email = `${name}-${id}@example.com`;
  await db.insert(s.users).values({ id, name, email, phone: null, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string, email };
}

const day = (offset: number) => {
  const d = new Date(`${israelToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

let owner: Who;
let tenant: Who;
let propertyId: string;
let leaseId: string;

async function makeLease(endInDays: number) {
  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id, street: 'לבנדה', houseNumber: '14', city: 'תל אביב-יפו',
    neighborhood: 'פלורנטין', lat: '32.05', lng: '34.77', rooms: '3', sqm: 62, floor: 1, totalFloors: 3,
    monthlyRentAgorot: 840_000, status: 'occupied', listed: false, availabilityConfidence: 'unknown',
  });
  leaseId = newId('lease');
  await db.insert(s.leases).values({
    id: leaseId, propertyId, tenantId: tenant.id, startDate: day(-300), endDate: day(endInDays),
    monthlyRentAgorot: 840_000, depositAgorot: 1_680_000, paymentMethod: 'bank_transfer', noticePeriodDays: 60,
  });
}

const mine = async (who: Who) => {
  const body = (await req('GET', '/renewals', who)).json();
  return body.renewals.find((r: { leaseId: string }) => r.leaseId === leaseId);
};

beforeEach(async () => {
  owner = await makeUser('owner');
  tenant = await makeUser('tenant');
  sentMail.length = 0;
});

describe('opening', () => {
  it('is upcoming far from the end, and opens itself three months before', async () => {
    await makeLease(200);
    expect((await mine(tenant)).stage).toBe('upcoming');

    await db.update(s.leases).set({ endDate: day(80) }).where(eq(s.leases.id, leaseId));
    const view = await mine(tenant);
    expect(view.stage).toBe('awaiting_tenant');
    expect(view.tenantStep).toBe('decide');
    expect((await mine(owner)).ownerStep).toBeNull();
  });

  it('lets either side start early', async () => {
    await makeLease(200);
    expect((await req('POST', `/renewals/${leaseId}/open`, owner)).json().stage).toBe('awaiting_tenant');
  });

  it('reuses an answer the tenant already gave', async () => {
    await makeLease(80);
    await db.update(s.leases).set({ renewalIntent: 'leave' }).where(eq(s.leases.id, leaseId));
    expect((await mine(owner)).stage).toBe('leaving');
  });

  it('hides the lease from strangers', async () => {
    await makeLease(80);
    const stranger = await makeUser('stranger');
    expect((await req('POST', `/renewals/${leaseId}/decision`, stranger, { decision: 'stay' })).statusCode).toBe(404);
  });
});

describe('the tenant stays', () => {
  it('runs from yes to a signed renewal without anyone messaging anyone', async () => {
    await makeLease(80);
    const yes = await req('POST', `/renewals/${leaseId}/decision`, tenant, { decision: 'stay' });
    expect(yes.json().stage).toBe('staying');
    expect(sentMail.some((m) => m.subject.includes('רוצה להישאר'))).toBe(true);
    expect((await mine(owner)).ownerStep).toBe('offer_meeting_times');

    const offered = await req('POST', `/renewals/${leaseId}/meeting-slots`, owner, {
      windows: [{ date: day(3), from: '18:00', until: '19:00' }],
    });
    const slots = offered.json().meetingSlots;
    expect(slots).toHaveLength(2);
    expect((await mine(tenant)).tenantStep).toBe('pick_meeting_time');

    await req('POST', `/renewals/meeting-slots/${slots[0].id}/book`, tenant);
    /* Picking another time gives the first one back. */
    const moved = (await req('POST', `/renewals/meeting-slots/${slots[1].id}/book`, tenant)).json();
    expect(moved.meeting.id).toBe(slots[1].id);
    expect(moved.meetingSlots.find((x: { id: string }) => x.id === slots[0].id).status).toBe('open');

    const done = await req('POST', `/renewals/${leaseId}/complete`, owner, { newEndDate: day(445), monthlyRent: 8600 });
    expect(done.json().stage).toBe('renewed');
    const [lease] = await db.select().from(s.leases).where(eq(s.leases.id, leaseId));
    expect(lease.endDate).toBe(day(445));
    expect(lease.monthlyRentAgorot).toBe(860_000);
  });

  it('only the tenant decides while they are within their deadline', async () => {
    await makeLease(80);
    await mine(tenant);
    expect((await req('POST', `/renewals/${leaseId}/decision`, owner, { decision: 'leave' })).statusCode).toBe(403);
  });
});

describe('questions before deciding', () => {
  it('goes tenant → owner → tenant, with a deadline and the final answer', async () => {
    await makeLease(80);
    const asked = await req('POST', `/renewals/${leaseId}/questions`, tenant, {
      topics: ['rent_same', 'extend_year'], text: 'אפשר לצבוע לפני?',
    });
    expect(asked.json().stage).toBe('questions');
    expect(asked.json().questions).toHaveLength(3);
    expect((await mine(owner)).ownerStep).toBe('answer_questions');

    const deadline = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const answered = await req('POST', `/renewals/${leaseId}/answers`, owner, {
      answers: [{ topic: 'rent_same', answer: 'כן, אותו שכר דירה' }, { topic: 'other', answer: 'כן, בשבוע הבא' }],
      deadline,
    });
    expect(answered.json().stage).toBe('answered');
    const seen = await mine(tenant);
    expect(seen.answers).toHaveLength(2);
    expect(seen.tenantStep).toBe('decide');
    expect(seen.answerBy).toBe(deadline);
  });

  it('hands the owner the next step once the tenant misses the deadline', async () => {
    await makeLease(80);
    await mine(tenant);
    await db.update(s.renewalCycles).set({ decisionDeadline: new Date(Date.now() - 1000) }).where(eq(s.renewalCycles.leaseId, leaseId));
    const view = await mine(owner);
    expect(view.overdue).toBe(true);
    expect(view.ownerStep).toBe('tenant_overdue');
    /* More time is one tap; or start the search. */
    expect((await req('POST', `/renewals/${leaseId}/deadline`, owner, { days: 3 })).json().overdue).toBe(false);
    await db.update(s.renewalCycles).set({ decisionDeadline: new Date(Date.now() - 1000) }).where(eq(s.renewalCycles.leaseId, leaseId));
    expect((await req('POST', `/renewals/${leaseId}/decision`, owner, { decision: 'leave' })).json().stage).toBe('leaving');
  });
});

describe('the tenant leaves', () => {
  async function watcher(name: string, profile: Partial<typeof s.renterProfiles.$inferInsert> = {}) {
    const u = await makeUser(name);
    await db.insert(s.renterProfiles).values({
      userId: u.id, incomeToRentRatio: '4.00', employment: 'salaried', hasGuarantors: true, occupants: 2,
      pets: false, smoker: false, leaseLengthMonths: 12, priorLandlordReference: true, complete: true, ...profile,
    });
    const leadId = newId('lead');
    await db.insert(s.leads).values({
      id: leadId, propertyId, seekerId: u.id, stage: 'new', desiredMoveIn: day(90), queuePosition: 0, watchOnly: true,
      incomeToRentRatio: '4.00', employment: 'salaried', hasGuarantors: true, occupants: 2, pets: false, smoker: false,
      leaseLengthMonths: 12, priorLandlordReference: true, createdAt: new Date(Date.now() - 86_400_000),
    });
    return { ...u, leadId };
  }

  it('publishes the date, then lists the flat and invites followers once the owner confirms', async () => {
    await makeLease(80);
    const follower = await watcher('follower');

    await req('POST', `/renewals/${leaseId}/decision`, tenant, { decision: 'leave' });
    const [property] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
    expect(property.status).toBe('vacating');
    expect(property.availableFrom).toBe(day(81));
    expect((await mine(owner)).ownerStep).toBe('review_requirements');

    sentMail.length = 0;
    const opened = await req('POST', `/renewals/${leaseId}/requirements`, owner, {
      monthlyRent: 8900, smokingAllowed: false, petsAllowed: true, minLeaseMonths: 12,
    });
    expect(opened.json().replacement.applicantsOpen).toBe(true);
    const [after] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
    expect(after.listed).toBe(true);
    expect(after.monthlyRentAgorot).toBe(890_000);
    expect(after.amenities).toContain('pets_allowed');
    expect(after.smokingAllowed).toBe(false);
    expect(sentMail.some((m) => m.to === follower.email)).toBe(true);

    const feed = (await req('GET', '/notifications', follower)).json();
    expect(feed.items.some((i: { kind: string }) => i.kind === 'apply_invite')).toBe(true);

    /* One tap: the follower becomes an applicant with the profile they had. */
    const applied = await req('POST', `/leads/${follower.leadId}/apply`, follower);
    expect(applied.statusCode).toBe(200);
    const view = await mine(owner);
    expect(view.replacement.applicants).toBe(1);
    expect(view.replacement.strongMatches).toBe(1);
    expect(view.ownerStep).toBe('set_viewing_times');
  });

  it('ranks against the requirements set for this flat', async () => {
    await makeLease(80);
    const smoker = await watcher('smoker', { smoker: true });
    await req('POST', `/renewals/${leaseId}/decision`, tenant, { decision: 'leave' });
    await req('POST', `/renewals/${leaseId}/requirements`, owner, { smokingAllowed: false });
    await req('POST', `/leads/${smoker.leadId}/apply`, smoker);
    expect((await mine(owner)).replacement.strongMatches).toBe(0);
  });

  it('opens the search on its own if the owner says nothing for two days', async () => {
    await makeLease(80);
    await req('POST', `/renewals/${leaseId}/decision`, tenant, { decision: 'leave' });
    await db.update(s.renewalCycles).set({ decidedAt: new Date(Date.now() - 49 * 3_600_000) }).where(eq(s.renewalCycles.leaseId, leaseId));
    const view = await mine(owner);
    expect(view.replacement.applicantsOpen).toBe(true);
    const [property] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
    expect(property.listed).toBe(true);
  });

  it('lets the tenant change their mind until the flat is open to applicants', async () => {
    await makeLease(80);
    await req('POST', `/renewals/${leaseId}/decision`, tenant, { decision: 'leave' });
    expect((await mine(tenant)).canChangeDecision).toBe(true);
    expect((await req('POST', `/renewals/${leaseId}/decision`, tenant, { decision: 'stay' })).json().stage).toBe('staying');
    const [property] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
    expect(property.availableFrom).toBeNull();

    await req('POST', `/renewals/${leaseId}/decision`, tenant, { decision: 'leave' });
    await req('POST', `/renewals/${leaseId}/requirements`, owner, {});
    expect((await mine(tenant)).canChangeDecision).toBe(false);
    expect((await req('POST', `/renewals/${leaseId}/decision`, tenant, { decision: 'stay' })).statusCode).toBe(403);
  });

  it('never names an applicant to the tenant', async () => {
    await makeLease(80);
    const follower = await watcher('נועה-מועמדת');
    await req('POST', `/renewals/${leaseId}/decision`, tenant, { decision: 'leave' });
    await req('POST', `/renewals/${leaseId}/requirements`, owner, {});
    await req('POST', `/leads/${follower.leadId}/apply`, follower);
    const raw = JSON.stringify((await req('GET', '/renewals', tenant)).json());
    expect(raw).not.toContain('נועה-מועמדת');
    expect(raw).not.toMatch(/"replacement":\{/);
  });
});

describe('viewing availability', () => {
  it('cuts each window into back-to-back 15-minute viewings, and one person wins a race', async () => {
    await makeLease(80);
    await db.update(s.properties).set({ listed: true }).where(eq(s.properties.id, propertyId));
    const res = await req('POST', '/viewings/windows', owner, {
      propertyId,
      windows: [{ date: day(4), from: '17:00', until: '18:00' }, { date: day(5), from: '10:00', until: '10:30' }],
    });
    const slots = res.json().slots;
    expect(slots).toHaveLength(6);
    expect(new Date(slots[1].startsAt).getTime() - new Date(slots[0].startsAt).getTime()).toBe(15 * 60_000);

    const people = await Promise.all(['a', 'b'].map(async (n) => {
      const u = await makeUser(n);
      const leadId = newId('lead');
      await db.insert(s.leads).values({
        id: leadId, propertyId, seekerId: u.id, stage: 'new', desiredMoveIn: day(81), queuePosition: 1, watchOnly: false,
        incomeToRentRatio: '4.00', employment: 'salaried', hasGuarantors: true, occupants: 1, pets: false, smoker: false,
        leaseLengthMonths: 12, priorLandlordReference: true,
      });
      return { ...u, leadId };
    }));
    const results = await Promise.all(
      people.map((p) => req('POST', `/viewings/${slots[0].id}/book`, p, { leadId: p.leadId })),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 403]);
  });
});
