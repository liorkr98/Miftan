import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import { israelMonth, notificationFeedSchema, okSchema, zonedWallTime, type NotificationView } from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { isCurrentTenant, resolveViewer } from '../policy/viewer.ts';

/**
 * The notification feed, derived on read.
 *
 * Every item comes from a row that already exists, looked at from the side of
 * the reader: an owner hears about their units, a tenant about their own lease
 * and tickets, a seeker about their own applications and questions. Nothing
 * here crosses a privacy boundary the rest of the API holds — the tenant's
 * renewal question carries the flat, never who asked; the seeker's answer
 * carries the owner's reply, never the tenant's.
 *
 * Unread is "newer than the last time the bell was opened", one timestamp per
 * account, rather than a flag per item that would need a table of its own.
 */

const WINDOW_DAYS = 30;
const LIMIT = 40;

type Item = Omit<NotificationView, 'unread'> & { atDate: Date };

const label = (p: { street: string; houseNumber: string }) => `${p.street} ${p.houseNumber}`;

export async function notificationRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/notifications',
    { onRequest: [app.authenticate], schema: { response: { 200: notificationFeedSchema } } },
    async (request) => {
      const userId = request.currentUser!.id;
      const viewer = await resolveViewer(userId);
      const owned = [...viewer.ownedPropertyIds];
      const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
      const items: Item[] = [];

      /* ── Owner ─────────────────────────────────────────── */
      if (owned.length > 0) {
        const tickets = await db
          .select({ t: s.tickets, p: s.properties })
          .from(s.tickets)
          .innerJoin(s.properties, eq(s.properties.id, s.tickets.propertyId))
          .where(
            and(
              inArray(s.tickets.propertyId, owned),
              isNull(s.tickets.deletedAt),
              or(
                and(eq(s.tickets.status, 'new'), gte(s.tickets.createdAt, since)),
                and(eq(s.tickets.status, 'awaiting_receipt'), isNotNull(s.tickets.receiptUploadedAt), gte(s.tickets.receiptUploadedAt, since)),
              ),
            ),
          );
        for (const { t, p } of tickets) {
          const receipt = t.status === 'awaiting_receipt';
          const at = receipt ? t.receiptUploadedAt! : t.createdAt;
          items.push({
            id: `${receipt ? 'receipt' : 'ticket'}:${t.id}`,
            kind: receipt ? 'receipt_uploaded' : 'ticket_new',
            role: 'owner', at: at.toISOString(), atDate: at,
            propertyLabel: label(p), detail: t.title, date: null, href: '/owner/tickets',
          });
        }

        const leads = await db
          .select({ l: s.leads, p: s.properties, u: s.users })
          .from(s.leads)
          .innerJoin(s.properties, eq(s.properties.id, s.leads.propertyId))
          .innerJoin(s.users, eq(s.users.id, s.leads.seekerId))
          .where(
            and(
              inArray(s.leads.propertyId, owned),
              isNull(s.leads.deletedAt),
              eq(s.leads.watchOnly, false),
              gte(s.leads.createdAt, since),
            ),
          );
        for (const { l, p, u } of leads) {
          items.push({
            id: `lead:${l.id}`, kind: 'lead_new', role: 'owner',
            at: l.createdAt.toISOString(), atDate: l.createdAt,
            /* The owner is entitled to the applicant's name; that is what an application is. */
            propertyLabel: label(p), detail: u.name, date: null, href: '/owner/leads?tab=leads',
          });
        }

        const inquiries = await db
          .select({ i: s.availabilityInquiries, p: s.properties })
          .from(s.availabilityInquiries)
          .innerJoin(s.properties, eq(s.properties.id, s.availabilityInquiries.propertyId))
          .where(
            and(
              inArray(s.availabilityInquiries.propertyId, owned),
              inArray(s.availabilityInquiries.status, ['new', 'answered']),
            ),
          );
        for (const { i, p } of inquiries) {
          const answered = i.status === 'answered';
          const at = answered ? (i.tenantAnsweredAt ?? i.updatedAt) : i.createdAt;
          if (at < since) continue;
          items.push({
            id: `inquiry:${i.id}:${i.status}`,
            kind: answered ? 'inquiry_answered' : 'inquiry_new',
            role: 'owner', at: at.toISOString(), atDate: at,
            propertyLabel: label(p), detail: null, date: null, href: '/owner/leads?tab=inquiries',
          });
        }

        /* Rent: anything short of paid for a month that has started. */
        const thisMonth = israelMonth();
        const unpaid = await db
          .select({ r: s.rentPayments, p: s.properties })
          .from(s.rentPayments)
          .innerJoin(s.properties, eq(s.properties.id, s.rentPayments.propertyId))
          .where(
            and(
              inArray(s.rentPayments.propertyId, owned),
              lte(s.rentPayments.month, thisMonth),
              lt(s.rentPayments.paidAgorot, s.rentPayments.dueAgorot),
              gte(s.rentPayments.month, since.toISOString().slice(0, 7)),
            ),
          );
        for (const { r: row, p } of unpaid) {
          /* Due on the 10th; before that it is not late, just not yet paid. */
          const due = zonedWallTime(`${row.month}-10`, '09:00');
          if (due > new Date()) continue;
          items.push({
            id: `rent:${row.id}`, kind: 'rent_unpaid', role: 'owner',
            at: due.toISOString(), atDate: due,
            propertyLabel: label(p), detail: row.month, date: null, href: '/owner/finance',
          });
        }

        const messages = await db
          .select({ m: s.threadMessages, th: s.messageThreads })
          .from(s.threadMessages)
          .innerJoin(s.messageThreads, eq(s.messageThreads.id, s.threadMessages.threadId))
          .where(
            and(
              eq(s.messageThreads.ownerId, userId),
              ne(s.threadMessages.authorRole, 'owner'),
              eq(s.threadMessages.read, false),
              gte(s.threadMessages.at, since),
            ),
          );
        for (const { m, th } of messages) {
          items.push({
            id: `message:${m.id}`, kind: 'message_new', role: 'owner',
            at: m.at.toISOString(), atDate: m.at,
            propertyLabel: th.subject, detail: th.counterpartyName, date: null, href: '/owner/leads?tab=messages',
          });
        }
      }

      /* ── Tenant ────────────────────────────────────────── */
      const myTickets = await db
        .select({ t: s.tickets, p: s.properties })
        .from(s.tickets)
        .innerJoin(s.properties, eq(s.properties.id, s.tickets.propertyId))
        .where(
          and(
            eq(s.tickets.tenantId, userId),
            isNull(s.tickets.deletedAt),
            gte(s.tickets.updatedAt, since),
            or(
              and(inArray(s.tickets.status, ['assigned', 'in_progress']), isNotNull(s.tickets.scheduledAt)),
              eq(s.tickets.status, 'closed'),
            ),
          ),
        );
      for (const { t, p } of myTickets) {
        const closed = t.status === 'closed';
        items.push({
          id: `${closed ? 'closed' : 'visit'}:${t.id}`,
          kind: closed ? 'ticket_closed' : 'visit_scheduled',
          role: 'tenant', at: t.updatedAt.toISOString(), atDate: t.updatedAt,
          propertyLabel: label(p), detail: t.title,
          date: closed ? null : (t.scheduledAt?.toISOString() ?? null),
          href: '/tenant/tickets',
        });
      }

      const tenanted = [...viewer.tenantPropertyIds].filter((id) => isCurrentTenant(viewer, id));
      if (tenanted.length > 0) {
        /* The question about their lease — the flat, never the person asking. */
        const questions = await db
          .select({ i: s.availabilityInquiries, p: s.properties })
          .from(s.availabilityInquiries)
          .innerJoin(s.properties, eq(s.properties.id, s.availabilityInquiries.propertyId))
          .where(
            and(
              inArray(s.availabilityInquiries.propertyId, tenanted),
              eq(s.availabilityInquiries.status, 'asked_tenant'),
            ),
          );
        for (const { i, p } of questions) {
          const at = i.askedTenantAt ?? i.updatedAt;
          items.push({
            id: `question:${i.id}`, kind: 'renewal_question', role: 'tenant',
            at: at.toISOString(), atDate: at,
            propertyLabel: label(p), detail: null, date: null, href: '/tenant/renewal',
          });
        }

        const proposals = await db
          .select({ l: s.leases, p: s.properties })
          .from(s.leases)
          .innerJoin(s.properties, eq(s.properties.id, s.leases.propertyId))
          .where(
            and(
              eq(s.leases.tenantId, userId),
              isNull(s.leases.deletedAt),
              isNotNull(s.leases.proposedSentAt),
              gte(s.leases.proposedSentAt, since),
            ),
          );
        for (const { l, p } of proposals) {
          items.push({
            id: `proposal:${l.id}:${l.proposedSentAt!.getTime()}`, kind: 'renewal_proposal', role: 'tenant',
            at: l.proposedSentAt!.toISOString(), atDate: l.proposedSentAt!,
            propertyLabel: label(p), detail: null, date: l.proposedStartDate, href: '/tenant/renewal',
          });
        }
      }

      /* ── Seeker ────────────────────────────────────────── */
      const replies = await db
        .select({ i: s.availabilityInquiries, p: s.properties })
        .from(s.availabilityInquiries)
        .innerJoin(s.properties, eq(s.properties.id, s.availabilityInquiries.propertyId))
        .where(
          and(
            eq(s.availabilityInquiries.seekerId, userId),
            inArray(s.availabilityInquiries.status, ['replied', 'declined']),
            isNotNull(s.availabilityInquiries.ownerRepliedAt),
            gte(s.availabilityInquiries.ownerRepliedAt, since),
          ),
        );
      for (const { i, p } of replies) {
        items.push({
          id: `reply:${i.id}`, kind: 'inquiry_replied', role: 'seeker',
          at: i.ownerRepliedAt!.toISOString(), atDate: i.ownerRepliedAt!,
          /* Only what the seeker already sees on the listing: the flat and the
             date the owner published. The tenant's answer never travels here. */
          propertyLabel: label(p), detail: null, date: i.resultingAvailableFrom, href: `/search/${p.id}`,
        });
      }

      const applications = await db
        .select({ l: s.leads, p: s.properties })
        .from(s.leads)
        .innerJoin(s.properties, eq(s.properties.id, s.leads.propertyId))
        .where(
          and(
            eq(s.leads.seekerId, userId),
            isNull(s.leads.deletedAt),
            gte(s.leads.updatedAt, since),
          ),
        );
      for (const { l, p } of applications) {
        if (l.watchOnly) {
          /* Followed without a date, and now it has one. */
          if (p.availableFrom && p.updatedAt > l.createdAt && p.updatedAt >= since) {
            items.push({
              id: `dated:${l.id}:${p.availableFrom}`, kind: 'followed_dated', role: 'seeker',
              at: p.updatedAt.toISOString(), atDate: p.updatedAt,
              propertyLabel: label(p), detail: null, date: p.availableFrom, href: `/search/${p.id}`,
            });
          }
          continue;
        }
        /* The owner moved the application on. 'new' is where it started. */
        if (l.stage !== 'new' && l.updatedAt.getTime() - l.createdAt.getTime() > 1000) {
          items.push({
            id: `stage:${l.id}:${l.stage}`, kind: 'application_stage', role: 'seeker',
            at: l.updatedAt.toISOString(), atDate: l.updatedAt,
            propertyLabel: label(p), detail: l.stage, date: null, href: '/search/queue',
          });
        }
      }

      const [me] = await db
        .select({ seen: s.users.notificationsSeenAt })
        .from(s.users)
        .where(eq(s.users.id, userId));
      const seen = me?.seen ?? null;

      const feed = items
        .sort((a, b) => b.atDate.getTime() - a.atDate.getTime())
        .slice(0, LIMIT)
        .map(({ atDate, ...item }) => ({ ...item, unread: seen === null || atDate > seen }));

      return { items: feed, unread: feed.filter((x) => x.unread).length };
    },
  );

  /** Opening the bell marks everything up to now as seen. */
  r.post(
    '/notifications/seen',
    { onRequest: [app.authenticate], schema: { response: { 200: okSchema } } },
    async (request) => {
      await db
        .update(s.users)
        .set({ notificationsSeenAt: sql`now()` })
        .where(eq(s.users.id, request.currentUser!.id));
      return { ok: true as const };
    },
  );

}
