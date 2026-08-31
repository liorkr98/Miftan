import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * The availability chain: seeker → owner → tenant → owner → seeker.
 *
 * The thing under test is that the chain has a valve in the middle. The tenant
 * tells their landlord something candid; the seeker gets a date and a sentence
 * the owner wrote. If those two ever meet, the tenant stops answering honestly
 * and the product's central claim stops being true.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';

let owner = { id: '', token: '' };
let tenant = { id: '', token: '' };
let seeker = { id: '', token: '' };
let propertyId: string;

/* The sentence the tenant must be able to say without a stranger reading it. */
const PRIVATE_NOTE = 'אנחנו כנראה עוזבים, אבל עוד לא סיפרנו בעבודה';

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

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`, '0521112222');
  tenant = await makeUser('מיכל שטרן', `ten-${n}@example.com`, '0543334444');
  seeker = await makeUser('טל אבירם', `see-${n}@example.com`, '0505556666');

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'occupied', listed: true,
  });
  await db.insert(s.leases).values({
    id: newId('lease'), propertyId, tenantId: tenant.id,
    startDate: '2025-01-01', endDate: '2099-01-01',
    monthlyRentAgorot: 1_040_000, paymentMethod: 'bank_transfer',
  });
});

async function ask() {
  const res = await req('POST', '/inquiries', seeker.token, {
    propertyId,
    message: 'שלום, האם הדירה צפויה להתפנות בסתיו?',
    desiredMoveIn: '2026-11-01',
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('the chain', () => {
  it('runs end to end and publishes a date only the owner chose', async () => {
    const inquiry = await ask();
    expect(inquiry.scope).toBe('seeker');
    expect(inquiry.status).toBe('new');

    /* Owner sees it, with the seeker's identity. */
    const onBoard = (await req('GET', '/inquiries', owner.token)).json().inquiries;
    expect(onBoard).toHaveLength(1);
    expect(onBoard[0].scope).toBe('owner');
    expect(onBoard[0].seeker.name).toBe('טל אבירם');
    expect(onBoard[0].tenant.name).toBe('מיכל שטרן');

    /* Before forwarding, the tenant is not a party to this at all. */
    expect((await req('GET', '/inquiries', tenant.token)).json().inquiries).toEqual([]);

    const asked = (await req('POST', `/inquiries/${inquiry.id}/ask-tenant`, owner.token)).json();
    expect(asked.status).toBe('asked_tenant');

    /* Now it reaches them — as a question from their landlord. */
    const tenantView = (await req('GET', '/inquiries', tenant.token)).json().inquiries;
    expect(tenantView).toHaveLength(1);
    expect(tenantView[0].scope).toBe('tenant');
    expect(tenantView[0].answered).toBe(false);

    const answered = (
      await req('POST', `/inquiries/${inquiry.id}/answer`, tenant.token, {
        answer: 'leave',
        note: PRIVATE_NOTE,
      })
    ).json();
    expect(answered.answered).toBe(true);

    /* The owner, and only the owner, sees what the tenant actually said. */
    const withAnswer = (await req('GET', '/inquiries', owner.token)).json().inquiries[0];
    expect(withAnswer.tenantAnswer).toBe('leave');
    expect(withAnswer.tenantAnswerNote).toBe(PRIVATE_NOTE);

    const replied = (
      await req('POST', `/inquiries/${inquiry.id}/reply`, owner.token, {
        reply: 'הדירה צפויה להתפנות בתחילת נובמבר. אשמח לתאם ביקור.',
        availableFrom: '2026-11-01',
        confidence: 'likely',
      })
    ).json();
    expect(replied.status).toBe('replied');

    const seekerView = (await req('GET', '/inquiries', seeker.token)).json().inquiries[0];
    expect(seekerView.scope).toBe('seeker');
    expect(seekerView.resultingAvailableFrom).toBe('2026-11-01');
    expect(seekerView.ownerReply).toContain('נובמבר');

    /* The date the owner published is now the property's public signal. */
    const [property] = await db.select().from(s.properties).where(eq(s.properties.id, propertyId));
    expect(property.availableFrom).toBe('2026-11-01');
    expect(property.availabilityConfidence).toBe('likely');
  });

  it('never lets the tenant’s words reach the seeker, through any inquiry route', async () => {
    const inquiry = await ask();
    await req('POST', `/inquiries/${inquiry.id}/ask-tenant`, owner.token);
    await req('POST', `/inquiries/${inquiry.id}/answer`, tenant.token, {
      answer: 'leave',
      note: PRIVATE_NOTE,
    });
    await req('POST', `/inquiries/${inquiry.id}/reply`, owner.token, {
      reply: 'הדירה צפויה להתפנות בנובמבר.',
      availableFrom: '2026-11-01',
    });

    /* Scan the raw body: a widened response shape must fail here, not pass. */
    const body = (await req('GET', '/inquiries', seeker.token)).body;
    expect(body).not.toContain(PRIVATE_NOTE);
    expect(body).not.toContain('tenantAnswer');
    expect(body).not.toContain('tenantAnswerNote');
    expect(body).not.toContain('מיכל שטרן');
    expect(body).not.toContain('0543334444');
  });

  it('does not tell the tenant who is asking', async () => {
    const inquiry = await ask();
    await req('POST', `/inquiries/${inquiry.id}/ask-tenant`, owner.token);

    const body = (await req('GET', '/inquiries', tenant.token)).body;
    /* Not the seeker's name, not their phone, and not the question as they
       phrased it — being asked to decide while a stranger waits is pressure,
       not information. */
    expect(body).not.toContain('טל אבירם');
    expect(body).not.toContain('0505556666');
    expect(body).not.toContain('סתיו');
  });

  it('refuses an answer to a question that was never forwarded', async () => {
    const inquiry = await ask();
    const res = await req('POST', `/inquiries/${inquiry.id}/answer`, tenant.token, { answer: 'leave' });
    expect(res.statusCode).toBe(404);
  });

  it('keeps strangers out entirely', async () => {
    const inquiry = await ask();
    const stranger = await makeUser('זר', `str-${Date.now()}@example.com`, '0509998888');

    expect((await req('GET', '/inquiries', stranger.token)).json().inquiries).toEqual([]);
    for (const action of ['ask-tenant', 'answer', 'reply', 'decline']) {
      const res = await req('POST', `/inquiries/${inquiry.id}/${action}`, stranger.token, {
        answer: 'leave', reply: 'x',
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it('will not let an owner open an inquiry against their own flat', async () => {
    const res = await req('POST', '/inquiries', owner.token, {
      propertyId, message: 'מה קורה', desiredMoveIn: '2026-11-01',
    });
    expect(res.statusCode).toBe(403);
  });

  it('refuses to forward a question when there is nobody to ask', async () => {
    const empty = newId('property');
    await db.insert(s.properties).values({
      id: empty, ownerId: owner.id,
      street: 'אמזלג', houseNumber: '9', city: 'תל אביב-יפו', neighborhood: 'נווה צדק',
      lat: '32.06', lng: '34.76', rooms: '2', sqm: 46, floor: 0, totalFloors: 2,
      monthlyRentAgorot: 890_000, status: 'vacant', listed: true,
    });
    const inquiry = (
      await req('POST', '/inquiries', seeker.token, {
        propertyId: empty, message: 'פנויה?', desiredMoveIn: '2026-11-01',
      })
    ).json();

    const res = await req('POST', `/inquiries/${inquiry.id}/ask-tenant`, owner.token);
    expect(res.statusCode).toBe(403);
  });

  it('records the tenant’s intent on the lease, where the public signal reads it', async () => {
    const inquiry = await ask();
    await req('POST', `/inquiries/${inquiry.id}/ask-tenant`, owner.token);
    await req('POST', `/inquiries/${inquiry.id}/answer`, tenant.token, { answer: 'extend' });

    const [lease] = await db.select().from(s.leases).where(eq(s.leases.propertyId, propertyId));
    expect(lease.renewalIntent).toBe('extend');
    expect(lease.renewalAskedAt).not.toBeNull();
  });
});
