import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  deriveAvailability,
  type OwnerProperty,
  type PropertyView,
  type PublicProperty,
  type TenantProperty,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { OPEN_TICKET_STATUSES } from './constants.ts';
import { scopeFor, type Viewer } from './viewer.ts';

/**
 * The one place a property row becomes something a caller can see.
 *
 * Every read of a property goes through `projectProperty`. Nothing else in the
 * codebase may hand a raw row to a response, because a raw row carries the
 * tenant, the notes and the renewal intent, and remembering to strip those on
 * each new endpoint is exactly the discipline that fails at 2am six months in.
 */

type PropertyRow = typeof s.properties.$inferSelect;
type LeaseRow = typeof s.leases.$inferSelect;
type UserRow = typeof s.users.$inferSelect;

export interface PropertyContext {
  property: PropertyRow;
  /** The active lease, if any. Never sent to a public viewer. */
  lease?: LeaseRow | null;
  tenant?: Pick<UserRow, 'id' | 'name' | 'phone'> | null;
  owner?: Pick<UserRow, 'id' | 'name' | 'phone'> | null;
  queueCount: number;
  openTicketCount: number;
}

/** The subset every scope shares. Deliberately small. */
function publicPart(ctx: PropertyContext): Omit<PublicProperty, 'scope'> {
  const { property, lease } = ctx;

  return {
    id: property.id,
    address: {
      street: property.street,
      number: property.houseNumber,
      city: property.city,
      neighborhood: property.neighborhood,
      lat: Number(property.lat),
      lng: Number(property.lng),
    },
    rooms: Number(property.rooms),
    sqm: property.sqm,
    floor: property.floor,
    totalFloors: property.totalFloors,
    amenities: property.amenities,
    photos: property.photos,
    monthlyRentAgorot: property.monthlyRentAgorot,
    arnonaBimonthlyAgorot: property.arnonaBimonthlyAgorot,
    vaadMonthlyAgorot: property.vaadMonthlyAgorot,
    /* The tenant's private answer crosses into public information here and
       nowhere else. What comes out is a kind, a date and a confidence. */
    availability: deriveAvailability({
      status: property.status,
      availableFrom: property.availableFrom,
      confidence: property.availabilityConfidence,
      renewalIntent: lease?.renewalIntent ?? null,
    }),
    queueCount: ctx.queueCount,
  };
}

function leaseTerms(lease: LeaseRow) {
  return {
    id: lease.id,
    startDate: lease.startDate,
    endDate: lease.endDate,
    monthlyRentAgorot: lease.monthlyRentAgorot,
    depositAgorot: lease.depositAgorot,
    paymentMethod: lease.paymentMethod,
    hasExtensionOption: lease.hasExtensionOption,
    extensionMonths: lease.extensionMonths,
    noticePeriodDays: lease.noticePeriodDays,
    renewalIntent: lease.renewalIntent,
    renewalAskedAt: lease.renewalAskedAt?.toISOString() ?? null,
  };
}

const contact = (u: Pick<UserRow, 'id' | 'name' | 'phone'>) => ({
  id: u.id,
  name: u.name,
  phone: u.phone,
});

export function projectProperty(viewer: Viewer, ctx: PropertyContext): PropertyView {
  const scope = scopeFor(viewer, ctx.property.id);
  const base = publicPart(ctx);

  if (scope === 'owner') {
    const owned: OwnerProperty = {
      ...base,
      scope: 'owner',
      status: ctx.property.status,
      listed: ctx.property.listed,
      notes: ctx.property.notes,
      lease: ctx.lease ? leaseTerms(ctx.lease) : null,
      tenant: ctx.tenant ? contact(ctx.tenant) : null,
      openTicketCount: ctx.openTicketCount,
    };
    return owned;
  }

  if (scope === 'tenant') {
    if (!ctx.lease) throw new Error('tenant scope requires a lease');
    const rented: TenantProperty = {
      ...base,
      scope: 'tenant',
      lease: leaseTerms(ctx.lease),
      /* A tenant needs to reach their landlord; they get no other identity. */
      owner: ctx.owner ? contact(ctx.owner) : { id: '', name: '', phone: null },
    };
    return rented;
  }

  /* Public. There is no `tenant`, `lease`, `notes` or `status` key to forget
     to remove, because the shape does not have them. */
  const anyone: PublicProperty = { ...base, scope: 'public' };
  return anyone;
}

/* ── Loading ───────────────────────────────────────────── */

/**
 * Loads the context for a set of properties in four queries rather than four
 * per property. The tenant join is only performed for properties the viewer
 * owns, so a seeker's request never even reads a tenant row.
 */
export async function loadPropertyContexts(
  viewer: Viewer,
  properties: PropertyRow[],
): Promise<PropertyContext[]> {
  if (properties.length === 0) return [];
  const ids = properties.map((p) => p.id);
  const today = new Date().toISOString().slice(0, 10);

  const privileged = properties.filter((p) => scopeFor(viewer, p.id) !== 'public').map((p) => p.id);

  const [leases, queueRows, ticketRows] = await Promise.all([
    /* Leases are needed for every scope — the availability signal depends on
       renewal intent — but only the privileged scopes ever see the row. */
    db
      .select()
      .from(s.leases)
      .where(
        and(
          inArray(s.leases.propertyId, ids),
          isNull(s.leases.deletedAt),
          sql`${s.leases.endDate} >= ${today}`,
        ),
      ),
    db
      .select({ propertyId: s.leads.propertyId, n: count() })
      .from(s.leads)
      .where(and(inArray(s.leads.propertyId, ids), isNull(s.leads.deletedAt), eq(s.leads.watchOnly, false)))
      .groupBy(s.leads.propertyId),
    privileged.length
      ? db
          .select({ propertyId: s.tickets.propertyId, n: count() })
          .from(s.tickets)
          .where(
            and(
              inArray(s.tickets.propertyId, privileged),
              isNull(s.tickets.deletedAt),
              inArray(s.tickets.status, OPEN_TICKET_STATUSES),
            ),
          )
          .groupBy(s.tickets.propertyId)
      : Promise.resolve([]),
  ]);

  const leaseByProperty = new Map(leases.map((l) => [l.propertyId, l]));
  const queueByProperty = new Map(queueRows.map((r) => [r.propertyId, r.n]));
  const ticketsByProperty = new Map(ticketRows.map((r) => [r.propertyId, r.n]));

  /* Identities are fetched only for properties where somebody is entitled to
     see them. A public request performs no query against users at all. */
  const ownerScoped = properties.filter((p) => scopeFor(viewer, p.id) === 'owner');
  const tenantScoped = properties.filter((p) => scopeFor(viewer, p.id) === 'tenant');

  const tenantIds = ownerScoped
    .map((p) => leaseByProperty.get(p.id)?.tenantId)
    .filter((id): id is string => Boolean(id));
  const ownerIds = tenantScoped.map((p) => p.ownerId);
  const identityIds = [...new Set([...tenantIds, ...ownerIds])];

  const identities = identityIds.length
    ? await db
        .select({ id: s.users.id, name: s.users.name, phone: s.users.phone })
        .from(s.users)
        .where(inArray(s.users.id, identityIds))
    : [];
  const identityById = new Map(identities.map((u) => [u.id, u]));

  return properties.map((property) => {
    const lease = leaseByProperty.get(property.id) ?? null;
    const scope = scopeFor(viewer, property.id);
    return {
      property,
      lease,
      tenant: scope === 'owner' && lease ? identityById.get(lease.tenantId) ?? null : null,
      owner: scope === 'tenant' ? identityById.get(property.ownerId) ?? null : null,
      queueCount: queueByProperty.get(property.id) ?? 0,
      openTicketCount: ticketsByProperty.get(property.id) ?? 0,
    };
  });
}
