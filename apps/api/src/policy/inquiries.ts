import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { InquiryView, OwnerInquiry, SeekerInquiry, TenantInquiry } from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { scopeFor, type Viewer } from './viewer.ts';

type InquiryRow = typeof s.availabilityInquiries.$inferSelect;
type PropertyRow = typeof s.properties.$inferSelect;
type Contact = { id: string; name: string; phone: string | null };

/**
 * Three readers, three shapes.
 *
 * The tenant's answer is the thing under guard. `tenantAnswer` and
 * `tenantAnswerNote` exist on exactly one of the three shapes, so a seeker
 * response has nowhere to put them even if a future caller tried.
 */
export interface InquiryContext {
  inquiry: InquiryRow;
  property: PropertyRow;
  seeker?: Contact | null;
  tenant?: Contact | null;
}

export function projectInquiry(viewer: Viewer, ctx: InquiryContext): InquiryView {
  const { inquiry: i, property } = ctx;
  const label = `${property.street} ${property.houseNumber}`;

  if (scopeFor(viewer, property.id) === 'owner') {
    const owned: OwnerInquiry = {
      scope: 'owner',
      id: i.id,
      propertyId: property.id,
      propertyLabel: label,
      status: i.status,
      message: i.message,
      desiredMoveIn: i.desiredMoveIn,
      createdAt: i.createdAt.toISOString(),
      seeker: ctx.seeker ?? { id: '', name: '', phone: null },
      tenant: ctx.tenant ?? null,
      askedTenantAt: i.askedTenantAt?.toISOString() ?? null,
      tenantAnswer: i.tenantAnswer,
      tenantAnswerNote: i.tenantAnswerNote,
      tenantAnsweredAt: i.tenantAnsweredAt?.toISOString() ?? null,
      ownerReply: i.ownerReply,
      resultingAvailableFrom: i.resultingAvailableFrom,
    };
    return owned;
  }

  /* The tenant of the flat being asked about. They see that their landlord
     asked, and their own answer — not who is waiting, and not the question as
     the stranger phrased it. */
  if (scopeFor(viewer, property.id) === 'tenant') {
    const mine: TenantInquiry = {
      scope: 'tenant',
      id: i.id,
      propertyId: property.id,
      propertyLabel: label,
      askedTenantAt: i.askedTenantAt?.toISOString() ?? null,
      answered: i.tenantAnsweredAt !== null,
      myAnswer: i.tenantAnswer,
      myNote: i.tenantAnswerNote,
    };
    return mine;
  }

  /* The seeker who asked. The owner's reply crosses back; the tenant's words
     never do. */
  const asked: SeekerInquiry = {
    scope: 'seeker',
    id: i.id,
    propertyId: property.id,
    propertyLabel: label,
    status: i.status,
    message: i.message,
    desiredMoveIn: i.desiredMoveIn,
    createdAt: i.createdAt.toISOString(),
    ownerReply: i.ownerReply,
    resultingAvailableFrom: i.resultingAvailableFrom,
  };
  return asked;
}

/** The live tenant of a property, if there is one. */
export async function currentTenants(propertyIds: string[]): Promise<Map<string, Contact>> {
  if (propertyIds.length === 0) return new Map();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      propertyId: s.leases.propertyId,
      id: s.users.id,
      name: s.users.name,
      phone: s.users.phone,
      endDate: s.leases.endDate,
    })
    .from(s.leases)
    .innerJoin(s.users, eq(s.users.id, s.leases.tenantId))
    .where(and(inArray(s.leases.propertyId, propertyIds), isNull(s.leases.deletedAt)))
    .orderBy(desc(s.leases.endDate));

  const byProperty = new Map<string, Contact>();
  for (const r of rows) {
    /* Ordered by end date descending, so the first row for a property is its
       most recent lease; skip it if that lease has already ended. */
    if (byProperty.has(r.propertyId) || r.endDate < today) continue;
    byProperty.set(r.propertyId, { id: r.id, name: r.name, phone: r.phone });
  }
  return byProperty;
}

export async function loadInquiryContexts(
  inquiries: InquiryRow[],
  opts: { withIdentities: boolean },
): Promise<InquiryContext[]> {
  if (inquiries.length === 0) return [];
  const propertyIds = [...new Set(inquiries.map((i) => i.propertyId))];

  const [properties, seekers, tenants] = await Promise.all([
    db.select().from(s.properties).where(inArray(s.properties.id, propertyIds)),
    /* Skipped entirely when the reader is not entitled to a name. */
    opts.withIdentities
      ? db
          .select({ id: s.users.id, name: s.users.name, phone: s.users.phone })
          .from(s.users)
          .where(inArray(s.users.id, [...new Set(inquiries.map((i) => i.seekerId))]))
      : Promise.resolve([]),
    opts.withIdentities ? currentTenants(propertyIds) : Promise.resolve(new Map<string, Contact>()),
  ]);

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const seekerById = new Map(seekers.map((u) => [u.id, u]));

  return inquiries.map((inquiry) => ({
    inquiry,
    property: propertyById.get(inquiry.propertyId)!,
    seeker: seekerById.get(inquiry.seekerId) ?? null,
    tenant: tenants.get(inquiry.propertyId) ?? null,
  }));
}
