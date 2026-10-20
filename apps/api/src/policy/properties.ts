import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  deriveAvailability,
  israelToday,
  type OwnerProperty,
  type PropertyView,
  type PublicProperty,
  type TenantProperty,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { OPEN_TICKET_STATUSES } from './constants.ts';
import { scopeFor, type Viewer } from './viewer.ts';
import { publicLocation } from './address.ts';
import { fileLinks } from '../storage/files.ts';

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
    photos: fileLinks(property.photos),
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
      showExactAddress: ctx.property.showExactAddress,
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
  const where = publicLocation(ctx.property);
  const anyone: PublicProperty = {
    ...base,
    address: { ...base.address, number: where.number, lat: where.lat, lng: where.lng },
    scope: 'public',
  };
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
  const today = israelToday();

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

  /* A unit can hold two live leases at once — the tenant living there and
     the one invited to follow. Which of them a row shows depends on who is
     asking: a tenant sees their own lease and never the other person's terms;
     everyone else sees the lease in force today, or failing that the next. */
  const leasesByProperty = new Map<string, LeaseRow[]>();
  for (const l of leases) {
    const list = leasesByProperty.get(l.propertyId) ?? [];
    list.push(l);
    leasesByProperty.set(l.propertyId, list);
  }
  const leaseFor = (propertyId: string): LeaseRow | null =>
    pickLease(leasesByProperty.get(propertyId) ?? [], today, scopeFor(viewer, propertyId) === 'tenant' ? viewer.userId : null);
  const leaseByProperty = new Map<string, LeaseRow>();
  for (const id of ids) {
    const lease = leaseFor(id);
    if (lease) leaseByProperty.set(id, lease);
  }
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

/**
 * The lease a row should show. HUMAN REVIEW: for a tenant this decides whose
 * terms they read.
 *
 * With tenantId: only that tenant's leases are candidates. Then: the lease in
 * force today (latest start wins if several), else the earliest upcoming one.
 */
export function pickLease(leases: LeaseRow[], today: string, tenantId: string | null): LeaseRow | null {
  const candidates = tenantId ? leases.filter((l) => l.tenantId === tenantId) : leases;
  const current = candidates
    .filter((l) => l.startDate <= today && l.endDate >= today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (current[0]) return current[0];
  const upcoming = candidates
    .filter((l) => l.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return upcoming[0] ?? null;
}
