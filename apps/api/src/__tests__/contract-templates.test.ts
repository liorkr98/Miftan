import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CONTRACT_DISCLAIMER, CONTRACT_TEMPLATES, placeholdersIn } from '@miftan/shared';
import { buildApp } from '../app.ts';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * Contract templates.
 *
 * Two failures to prevent. A placeholder printed into a signed contract — so
 * every `{{key}}` must be declared and every required one must be filled before
 * the document is called ready. And an owner's edit reaching another owner's
 * document — so built-ins are never edited in place, only cloned.
 */

let app: FastifyInstance;
const PASSWORD = 'a-long-enough-password';
let owner = { id: '', token: '' };
let other = { id: '', token: '' };
let tenant = { id: '', token: '' };
let propertyId: string;
let leaseId: string;

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
  await db.insert(s.users).values({ id, name, email, passwordHash: await hashPassword(PASSWORD) });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
  return { id, token: res.json().accessToken as string };
}

beforeEach(async () => {
  const n = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  owner = await makeUser('רן אלמוג', `own-${n}@example.com`);
  other = await makeUser('אורן שגב', `oth-${n}@example.com`);
  tenant = await makeUser('מיכל שטרן', `ten-${n}@example.com`);

  propertyId = newId('property');
  await db.insert(s.properties).values({
    id: propertyId, ownerId: owner.id,
    street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    district: 'tel_aviv',
    lat: '32.0651', lng: '34.7708', rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
    monthlyRentAgorot: 1_040_000, status: 'occupied',
  });

  leaseId = newId('lease');
  await db.insert(s.leases).values({
    id: leaseId, propertyId, tenantId: tenant.id,
    startDate: '2026-09-01', endDate: '2027-08-31',
    monthlyRentAgorot: 1_040_000, depositAgorot: 2_080_000,
    paymentMethod: 'bank_transfer', noticePeriodDays: 60,
  });
});

const STANDARD = 'ct-standard';

describe('the library', () => {
  it('ships with templates, each carrying the disclaimer', async () => {
    const res = (await req('GET', '/contract-templates', owner.token)).json();
    expect(res.templates.length).toBe(CONTRACT_TEMPLATES.length);
    expect(res.templates.every((tpl: { isBuiltIn: boolean }) => tpl.isBuiltIn)).toBe(true);
    expect(res.disclaimer).toBe(CONTRACT_DISCLAIMER);
    /* On the document itself, not only in the API envelope. */
    expect(res.templates[0].body).toContain(CONTRACT_DISCLAIMER);
  });

  it('declares every placeholder each built-in actually uses', async () => {
    for (const tpl of CONTRACT_TEMPLATES) {
      const declared = new Set(tpl.variables.map((v) => v.key));
      const used = placeholdersIn(tpl.body).filter((key) => key !== 'signed_date');
      const undeclared = used.filter((key) => !declared.has(key));
      /* A template that uses a field it never asks for renders `{{x}}` into a
         contract somebody signs. */
      expect(undeclared, `${tpl.id} uses undeclared ${undeclared.join(', ')}`).toEqual([]);
    }
  });
});

describe('editing', () => {
  const clone = (token: string, over: Record<string, unknown> = {}) => {
    const base = CONTRACT_TEMPLATES.find((x) => x.id === STANDARD)!;
    return req('POST', '/contract-templates', token, {
      basedOn: STANDARD,
      name: 'שכירות בלתי מוגנת — הנוסח שלי',
      description: 'עם סעיף חיות מחמד',
      useWhen: 'כשמותר להביא חיה',
      body: `${base.body}\n\n10. חיות מחמד\n   מותר להחזיק חיית מחמד אחת בהודעה למשכיר מראש.`,
      variables: base.variables,
      ...over,
    });
  };

  it('clones a built-in rather than editing it', async () => {
    const res = await clone(owner.token);
    expect(res.statusCode).toBe(201);
    expect(res.json().isBuiltIn).toBe(false);
    expect(res.json().basedOn).toBe(STANDARD);
    expect(res.json().body).toContain('חיות מחמד');

    /* The clone replaces the built-in in this owner's library — two documents
       with the same name and one silent difference is how the wrong one gets
       signed. */
    const library = (await req('GET', '/contract-templates', owner.token)).json();
    expect(library.templates).toHaveLength(CONTRACT_TEMPLATES.length);
    const standard = library.templates.find((x: { basedOn: string | null }) => x.basedOn === STANDARD);
    expect(standard.isBuiltIn).toBe(false);
  });

  it('never lets one owner’s wording reach another’s library', async () => {
    await clone(owner.token);
    const theirs = (await req('GET', '/contract-templates', other.token)).json();
    expect(theirs.templates.every((x: { isBuiltIn: boolean }) => x.isBuiltIn)).toBe(true);
    expect(JSON.stringify(theirs)).not.toContain('חיות מחמד');
  });

  it('updates the same clone rather than making a second one', async () => {
    const first = (await clone(owner.token)).json();
    const second = (await clone(owner.token, { name: 'שם אחר' })).json();
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('שם אחר');

    const library = (await req('GET', '/contract-templates', owner.token)).json();
    expect(library.templates).toHaveLength(CONTRACT_TEMPLATES.length);
  });

  it('refuses a body that uses a placeholder it never asks for', async () => {
    const res = await clone(owner.token, {
      body: 'חוזה שכירות בלתי מוגנת בין {{owner_name}} לבין {{tenant_name}} לגבי {{mystery_field}} בתנאים הבאים, לתקופה קצובה.',
      variables: [
        { key: 'owner_name', label: 'משכיר', kind: 'text', required: true },
        { key: 'tenant_name', label: 'שוכר', kind: 'text', required: true },
      ],
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.stringify(res.json())).toContain('mystery_field');
  });

  it('puts the built-in back when the clone is deleted', async () => {
    const cloned = (await clone(owner.token)).json();
    expect((await req('DELETE', `/contract-templates/${cloned.id}`, owner.token)).statusCode).toBe(200);

    const library = (await req('GET', '/contract-templates', owner.token)).json();
    const standard = library.templates.find((x: { id: string }) => x.id === STANDARD);
    expect(standard.isBuiltIn).toBe(true);
    expect(standard.body).not.toContain('חיות מחמד');
  });

  it('will not let one owner delete another’s template', async () => {
    const cloned = (await clone(owner.token)).json();
    expect((await req('DELETE', `/contract-templates/${cloned.id}`, other.token)).statusCode).toBe(404);
  });
});

describe('filling one in', () => {
  it('pre-fills from the tenancy', async () => {
    const res = (
      await req('POST', `/contract-templates/${STANDARD}/render`, owner.token, {
        leaseId,
        values: { owner_id: '000000000', tenant_id: '111111111', payment_day: '5' },
      })
    ).json();

    expect(res.text).toContain('רן אלמוג');
    expect(res.text).toContain('מיכל שטרן');
    expect(res.text).toContain('נחלת בנימין 55');
    expect(res.text).toContain('2026-09-01');
    expect(res.text).toContain('₪10,400');
    expect(res.text).toContain('₪20,800');
    expect(res.text).toContain('60 ימים');

    expect(res.missing).toEqual([]);
    expect(res.prefilled).toContain('monthly_rent');
    /* Never left in the document. */
    expect(res.text).not.toContain('{{');
  });

  it('names what is still missing rather than printing a placeholder', async () => {
    const res = (
      await req('POST', `/contract-templates/${STANDARD}/render`, owner.token, { leaseId })
    ).json();

    /* Identity numbers and the payment day are not on the lease. */
    expect(res.missing).toContain('owner_id');
    expect(res.missing).toContain('tenant_id');
    expect(res.missing).toContain('payment_day');
  });

  it('takes the owner’s correction over the stored lease', async () => {
    const res = (
      await req('POST', `/contract-templates/${STANDARD}/render`, owner.token, {
        leaseId,
        values: {
          owner_id: '1', tenant_id: '2', payment_day: '5',
          monthly_rent: '₪11,200',
        },
      })
    ).json();

    /* The lease says 10,400. The owner is looking at the paper. */
    expect(res.text).toContain('₪11,200');
    expect(res.text).not.toContain('₪10,400');
    expect(res.prefilled).not.toContain('monthly_rent');
  });

  it('renders without a tenancy at all', async () => {
    const res = (
      await req('POST', `/contract-templates/${STANDARD}/render`, owner.token, {
        values: {
          owner_name: 'רן', owner_id: '1', tenant_name: 'מיכל', tenant_id: '2',
          property_address: 'הרצל 88', rooms: '3',
          start_date: '2026-09-01', end_date: '2027-08-31',
          monthly_rent: '₪8,000', payment_day: '1', deposit: '₪16,000', notice_days: '60',
        },
      })
    ).json();
    expect(res.missing).toEqual([]);
    expect(res.text).toContain('הרצל 88');
  });

  it('keeps an owner out of a tenancy that is not theirs', async () => {
    const res = await req('POST', `/contract-templates/${STANDARD}/render`, other.token, { leaseId });
    expect(res.statusCode).toBe(404);
  });

  it('always returns the disclaimer with the document', async () => {
    const res = (
      await req('POST', `/contract-templates/${STANDARD}/render`, owner.token, { leaseId })
    ).json();
    expect(res.disclaimer).toBe(CONTRACT_DISCLAIMER);
    expect(res.text).toContain(CONTRACT_DISCLAIMER);
  });
});
