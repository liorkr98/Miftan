import { describe, expect, it } from 'vitest';
import { projectProperty, type PropertyContext } from '../policy/properties.ts';
import type { Viewer } from '../policy/viewer.ts';

/**
 * The projection layer, tested directly rather than through HTTP.
 *
 * There are two things standing between a tenant's name and a seeker: this
 * function, and Fastify's Zod response serialisation, which strips keys the
 * response schema does not declare. That second layer is genuinely useful — it
 * caught a deliberately broken projection during development — but it also
 * means an HTTP test cannot tell a correct projection from a broken one.
 *
 * So the projection gets its own tests. If somebody later widens
 * `publicPropertySchema` — a very plausible mistake while adding a field for
 * the owner view — the HTTP tests would go quiet and only these would fail.
 */

const OWNED = 'prop_owned';
const RENTED = 'prop_rented';
const STRANGER = 'prop_stranger';

const viewer: Viewer = {
  userId: 'usr_1',
  ownedPropertyIds: new Set([OWNED]),
  tenantPropertyIds: new Set([RENTED]),
};

function context(id: string): PropertyContext {
  return {
    property: {
      id,
      ownerId: 'usr_landlord',
      street: 'נחלת בנימין', houseNumber: '55', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
      lat: '32.0651', lng: '34.7708',
      rooms: '3.5', sqm: 80, floor: 5, totalFloors: 6,
      amenities: ['elevator'], photos: ['p.jpg'],
      monthlyRentAgorot: 1_040_000, arnonaBimonthlyAgorot: 94_000, vaadMonthlyAgorot: 29_000,
      status: 'occupied',
      availableFrom: '2099-07-15',
      availabilityConfidence: 'likely',
      listed: true,
      notes: 'PRIVATE-OWNER-NOTE',
      createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    },
    lease: {
      id: 'lease_1', propertyId: id, tenantId: 'usr_tenant',
      startDate: '2025-07-15', endDate: '2099-07-15',
      monthlyRentAgorot: 1_040_000, depositAgorot: 2_080_000,
      paymentMethod: 'bank_transfer',
      hasExtensionOption: true, extensionMonths: 12, noticePeriodDays: 60,
      renewalIntent: 'too_early', renewalAskedAt: null,
      proposedRentAgorot: null, proposedStartDate: null, proposedMonths: null, proposedSentAt: null,
      createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    },
    tenant: { id: 'usr_tenant', name: 'PRIVATE-TENANT-NAME', phone: '0521104488' },
    owner: { id: 'usr_landlord', name: 'רן אלמוג', phone: '0524418890' },
    queueCount: 4,
    openTicketCount: 2,
  };
}

const SECRETS = ['PRIVATE-TENANT-NAME', 'PRIVATE-OWNER-NOTE', '0521104488', 'too_early'];

describe('the public projection', () => {
  const view = projectProperty(viewer, context(STRANGER));
  const serialised = JSON.stringify(view);

  it('is the public scope', () => {
    expect(view.scope).toBe('public');
  });

  it.each(SECRETS)('does not contain %s anywhere', (secret) => {
    expect(serialised).not.toContain(secret);
  });

  it.each(['tenant', 'lease', 'notes', 'status', 'listed', 'owner'])(
    'has no "%s" key at all',
    (key) => {
      expect(Object.hasOwn(view, key)).toBe(false);
    },
  );

  it('still carries the derived signal, which is the whole point', () => {
    expect(view.availability).toEqual({
      kind: 'dated',
      date: '2099-07-15',
      confidence: 'likely',
      askable: true,
    });
    expect(view.queueCount).toBe(4);
  });
});

describe('the tenant projection', () => {
  const view = projectProperty(viewer, context(RENTED));

  it('carries their own lease and their landlord', () => {
    expect(view.scope).toBe('tenant');
    if (view.scope !== 'tenant') return;
    expect(view.lease.depositAgorot).toBe(2_080_000);
    expect(view.owner.name).toBe('רן אלמוג');
  });

  it('does not carry the owner private notes', () => {
    expect(JSON.stringify(view)).not.toContain('PRIVATE-OWNER-NOTE');
    expect(Object.hasOwn(view, 'notes')).toBe(false);
  });
});

describe('the owner projection', () => {
  const view = projectProperty(viewer, context(OWNED));

  it('carries the tenant, the lease, the intent and the notes', () => {
    expect(view.scope).toBe('owner');
    if (view.scope !== 'owner') return;
    expect(view.tenant?.name).toBe('PRIVATE-TENANT-NAME');
    expect(view.lease?.renewalIntent).toBe('too_early');
    expect(view.notes).toBe('PRIVATE-OWNER-NOTE');
    expect(view.openTicketCount).toBe(2);
  });
});
