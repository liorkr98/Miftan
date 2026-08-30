import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { OwnerTicket, TenantTicket, TicketView } from '@miftach/shared';
import { db, schema as s } from '../db/client.ts';
import { availableActions } from './ticket-state.ts';
import { scopeFor, type Viewer } from './viewer.ts';

type TicketRow = typeof s.tickets.$inferSelect;
type MessageRow = typeof s.ticketMessages.$inferSelect;
type VendorRow = typeof s.vendors.$inferSelect;
type PropertyRow = typeof s.properties.$inferSelect;
type UserRow = typeof s.users.$inferSelect;

export interface TicketContext {
  ticket: TicketRow;
  property: PropertyRow;
  vendor?: VendorRow | null;
  reporter?: Pick<UserRow, 'id' | 'name' | 'phone'> | null;
  messages: MessageRow[];
  expenseId?: string | null;
}

/**
 * A ticket as one of the two people involved may see it.
 *
 * There is no public shape: a maintenance ticket is never visible to a
 * stranger, so anything reaching this function has already been authorised.
 * `availableActions` comes from the server's own transition table, so the UI
 * can render the right buttons without re-implementing the rules — and without
 * being trusted to enforce them.
 */
export function projectTicket(viewer: Viewer, ctx: TicketContext): TicketView {
  const scope = scopeFor(viewer, ctx.property.id);
  const { ticket, property, vendor } = ctx;

  const base = {
    id: ticket.id,
    propertyId: property.id,
    propertyLabel: `${property.street} ${property.houseNumber}`,
    category: ticket.category,
    severity: ticket.severity,
    status: ticket.status,
    title: ticket.title,
    description: ticket.description,
    photos: ticket.photos,
    createdAt: ticket.createdAt.toISOString(),
    scheduledAt: ticket.scheduledAt?.toISOString() ?? null,
    tenantAvailability: ticket.tenantAvailability.map((d) => d.toISOString()),
    tenantConfirmedSlot: ticket.tenantConfirmedSlot,
    vendor: vendor
      ? { id: vendor.id, name: vendor.name, trade: vendor.trade, phone: vendor.phone }
      : null,
    receipt:
      ticket.receiptAmountAgorot != null
        ? {
            amountAgorot: ticket.receiptAmountAgorot,
            file: ticket.receiptFile,
            uploadedAt: ticket.receiptUploadedAt?.toISOString() ?? new Date(0).toISOString(),
            uploadedBy: ticket.receiptUploadedBy ?? ('owner' as const),
          }
        : null,
    messages: ctx.messages.map((m) => ({
      id: m.id,
      authorRole: m.authorRole,
      authorName: m.authorName,
      body: m.body,
      photos: m.photos,
      at: m.at.toISOString(),
    })),
    availableActions: availableActions(ticket.status, scope),
  };

  if (scope === 'owner') {
    const owned: OwnerTicket = {
      ...base,
      scope: 'owner',
      reportedBy: ctx.reporter
        ? { id: ctx.reporter.id, name: ctx.reporter.name, phone: ctx.reporter.phone }
        : null,
      /* Commercial terms with the tradesperson are the owner's business. */
      vendorCalloutFeeAgorot: vendor?.calloutFeeAgorot ?? null,
      expenseId: ctx.expenseId ?? null,
    };
    return owned;
  }

  const rented: TenantTicket = { ...base, scope: 'tenant' };
  return rented;
}

/** Loads everything the projection needs, in four queries regardless of count. */
export async function loadTicketContexts(tickets: TicketRow[]): Promise<TicketContext[]> {
  if (tickets.length === 0) return [];
  const ids = tickets.map((t) => t.id);

  const [properties, messages, vendors, expenses, reporters] = await Promise.all([
    db.select().from(s.properties).where(inArray(s.properties.id, [...new Set(tickets.map((t) => t.propertyId))])),
    db.select().from(s.ticketMessages).where(inArray(s.ticketMessages.ticketId, ids)).orderBy(asc(s.ticketMessages.at)),
    (() => {
      const vendorIds = [...new Set(tickets.map((t) => t.vendorId).filter((v): v is string => Boolean(v)))];
      return vendorIds.length ? db.select().from(s.vendors).where(inArray(s.vendors.id, vendorIds)) : Promise.resolve([]);
    })(),
    db.select({ id: s.expenses.id, ticketId: s.expenses.ticketId }).from(s.expenses).where(inArray(s.expenses.ticketId, ids)),
    (() => {
      const tenantIds = [...new Set(tickets.map((t) => t.tenantId).filter((v): v is string => Boolean(v)))];
      return tenantIds.length
        ? db.select({ id: s.users.id, name: s.users.name, phone: s.users.phone }).from(s.users).where(inArray(s.users.id, tenantIds))
        : Promise.resolve([]);
    })(),
  ]);

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const reporterById = new Map(reporters.map((u) => [u.id, u]));
  const expenseByTicket = new Map(expenses.map((e) => [e.ticketId!, e.id]));
  const messagesByTicket = new Map<string, MessageRow[]>();
  for (const m of messages) {
    messagesByTicket.set(m.ticketId, [...(messagesByTicket.get(m.ticketId) ?? []), m]);
  }

  return tickets.map((ticket) => ({
    ticket,
    property: propertyById.get(ticket.propertyId)!,
    vendor: ticket.vendorId ? vendorById.get(ticket.vendorId) ?? null : null,
    reporter: ticket.tenantId ? reporterById.get(ticket.tenantId) ?? null : null,
    messages: messagesByTicket.get(ticket.id) ?? [],
    expenseId: expenseByTicket.get(ticket.id) ?? null,
  }));
}

/** Every property this viewer has any relationship with. */
export function visiblePropertyIds(viewer: Viewer): string[] {
  return [...new Set([...viewer.ownedPropertyIds, ...viewer.tenantPropertyIds])];
}

export async function loadTicketOr404(ticketId: string) {
  const [ticket] = await db
    .select()
    .from(s.tickets)
    .where(and(eq(s.tickets.id, ticketId), isNull(s.tickets.deletedAt)));
  return ticket ?? null;
}
