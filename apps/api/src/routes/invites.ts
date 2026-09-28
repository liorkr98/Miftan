import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  acceptedInviteSchema,
  createdInviteSchema,
  createInviteSchema,
  inviteListSchema,
  invitePreviewSchema,
  okSchema,
  recordLeaseSchema,
  recordedLeaseSchema,
  israelToday,
  toAgorot,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { requireOwner, resolveViewer } from '../policy/viewer.ts';
import { joinBurst } from '../lib/rate-limit.ts';
import { isDemoAccount } from './auth.ts';

/**
 * Tenant invites.
 *
 * Nobody becomes a tenant by declaring it. An owner makes an invite for one
 * unit with the lease terms already fixed, sends the link, and whoever accepts
 * it becomes the tenant on exactly those terms. The token is 24 random bytes;
 * only its SHA-256 is stored, so a database read does not hand out working
 * links, and the owner sees the link once — a lost link is replaced, not
 * recovered.
 */

const INVITE_TTL_DAYS = 14;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const today = () => israelToday();

type InviteRow = typeof s.tenantInvites.$inferSelect;

function statusOf(row: InviteRow): 'open' | 'accepted' | 'revoked' | 'expired' {
  if (row.acceptedAt) return 'accepted';
  if (row.revokedAt) return 'revoked';
  if (row.expiresAt.getTime() < Date.now()) return 'expired';
  return 'open';
}

function ownerView(row: InviteRow) {
  return {
    id: row.id,
    propertyId: row.propertyId,
    status: statusOf(row),
    startDate: row.startDate,
    endDate: row.endDate,
    monthlyRentAgorot: row.monthlyRentAgorot,
    depositAgorot: row.depositAgorot,
    paymentMethod: row.paymentMethod,
    tenantName: row.tenantName,
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * A tenant recorded by the owner, with no account of their own. They cannot
 * sign in (no password, an address under .invalid that is never mailed); the
 * row exists so their lease can. An invite for the same dates later hands
 * the lease to the real account that accepts it.
 */
export const OFFLINE_TENANT_PREFIX = 'usr_offline_';
export const isOfflineTenant = (id: string) => id.startsWith(OFFLINE_TENANT_PREFIX);

/** A lease on the unit that overlaps [start, end] — two tenants at once is a typo. */
async function overlappingLease(propertyId: string, start: string, end: string) {
  const [row] = await db
    .select({ id: s.leases.id, tenantId: s.leases.tenantId, startDate: s.leases.startDate, endDate: s.leases.endDate })
    .from(s.leases)
    .where(
      and(
        eq(s.leases.propertyId, propertyId),
        isNull(s.leases.deletedAt),
        lte(s.leases.startDate, end),
        gte(s.leases.endDate, start),
      ),
    )
    .limit(1);
  return row;
}

export async function inviteRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/properties/:id/invites',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: createInviteSchema,
        response: { 201: createdInviteSchema },
      },
    },
    async (request, reply) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      requireOwner(viewer, request.params.id);
      const [owner] = await db.select().from(s.users).where(eq(s.users.id, viewer.userId));
      if (!owner?.emailVerifiedAt && !isDemoAccount(viewer.userId)) {
        throw new ApiError('email_unverified', 'verify your email before inviting anyone');
      }
      const b = request.body;

      /* The one overlap that is allowed: inviting the tenant the owner already
         recorded, onto that same lease. */
      const overlap = await overlappingLease(request.params.id, b.startDate, b.endDate);
      const takeover =
        overlap && isOfflineTenant(overlap.tenantId) && overlap.startDate === b.startDate && overlap.endDate === b.endDate
          ? overlap.id
          : null;
      if (overlap && !takeover) {
        throw new ApiError('validation_failed', 'the unit already has a lease in those dates', {
          startDate: ['overlaps an existing lease'],
        });
      }

      const token = randomBytes(24).toString('base64url');
      const id = newId('invite');

      await db.transaction(async (tx) => {
        /* One live link per unit: a new invite retires the previous one, so an
           old message in someone's WhatsApp cannot be used after the owner
           changed the terms. */
        await tx
          .update(s.tenantInvites)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(s.tenantInvites.propertyId, request.params.id),
              isNull(s.tenantInvites.acceptedAt),
              isNull(s.tenantInvites.revokedAt),
            ),
          );

        await tx.insert(s.tenantInvites).values({
          id,
          propertyId: request.params.id,
          createdBy: viewer.userId,
          tokenHash: hashToken(token),
          startDate: b.startDate,
          endDate: b.endDate,
          monthlyRentAgorot: toAgorot(b.monthlyRentShekels),
          depositAgorot: toAgorot(b.depositShekels),
          paymentMethod: b.paymentMethod,
          tenantName: b.tenantName ?? null,
          leaseId: takeover,
          expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
        });
      });

      const [row] = await db.select().from(s.tenantInvites).where(eq(s.tenantInvites.id, id));
      return reply.code(201).send({ invite: ownerView(row), token });
    },
  );

  r.get(
    '/properties/:id/invites',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: inviteListSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      requireOwner(viewer, request.params.id);
      const rows = await db
        .select()
        .from(s.tenantInvites)
        .where(eq(s.tenantInvites.propertyId, request.params.id))
        .orderBy(desc(s.tenantInvites.createdAt));
      return { invites: rows.map(ownerView) };
    },
  );

  r.delete(
    '/invites/:id',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: okSchema } },
    },
    async (request) => {
      const [row] = await db.select().from(s.tenantInvites).where(eq(s.tenantInvites.id, request.params.id));
      if (!row) throw new ApiError('not_found', 'no such invite');
      const viewer = await resolveViewer(request.currentUser!.id);
      requireOwner(viewer, row.propertyId);
      if (!row.acceptedAt && !row.revokedAt) {
        await db.update(s.tenantInvites).set({ revokedAt: new Date() }).where(eq(s.tenantInvites.id, row.id));
      }
      return { ok: true as const };
    },
  );

  /**
   * What the link shows before anyone signs in. Public on purpose — the
   * person holding the link may not have an account yet — so it says only
   * what they need to decide: the flat, the terms, the owner's first name.
   */
  r.get(
    '/join/:token',
    {
      onRequest: [joinBurst],
      schema: { params: z.object({ token: z.string().min(16).max(64) }), response: { 200: invitePreviewSchema } },
    },
    async (request) => {
      const [row] = await db
        .select({ invite: s.tenantInvites, property: s.properties, owner: s.users })
        .from(s.tenantInvites)
        .innerJoin(s.properties, eq(s.properties.id, s.tenantInvites.propertyId))
        .innerJoin(s.users, eq(s.users.id, s.tenantInvites.createdBy))
        .where(eq(s.tenantInvites.tokenHash, hashToken(request.params.token)));
      if (!row) throw new ApiError('not_found', 'no such invite');

      const { invite, property, owner } = row;
      return {
        status: statusOf(invite),
        propertyLabel: `${property.street} ${property.houseNumber}`,
        city: property.city,
        ownerFirstName: owner.name.split(' ')[0] ?? owner.name,
        startDate: invite.startDate,
        endDate: invite.endDate,
        monthlyRentAgorot: invite.monthlyRentAgorot,
        depositAgorot: invite.depositAgorot,
        paymentMethod: invite.paymentMethod,
        expiresAt: invite.expiresAt.toISOString(),
      };
    },
  );

  /** Accepting creates the lease, on the owner's terms, in one transaction. */
  r.post(
    '/join/:token/accept',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ token: z.string().min(16).max(64) }),
        response: { 200: acceptedInviteSchema },
      },
    },
    async (request) => {
      const userId = request.currentUser!.id;
      const tokenHash = hashToken(request.params.token);

      return db.transaction(async (tx) => {
        /* Locked, so two people opening the same link at once cannot both
           become the tenant. */
        const [invite] = await tx
          .select()
          .from(s.tenantInvites)
          .where(eq(s.tenantInvites.tokenHash, tokenHash))
          .for('update');
        if (!invite) throw new ApiError('not_found', 'no such invite');

        const status = statusOf(invite);
        if (status !== 'open') throw new ApiError('forbidden', `invite is ${status}`);
        if (invite.createdBy === userId) throw new ApiError('forbidden', 'an owner cannot rent their own unit');

        /* An invite made for a recorded tenant takes over that lease. */
        if (invite.leaseId) {
          const [lease] = await tx
            .select()
            .from(s.leases)
            .where(and(eq(s.leases.id, invite.leaseId), isNull(s.leases.deletedAt)))
            .for('update');
          if (!lease || !isOfflineTenant(lease.tenantId)) {
            throw new ApiError('forbidden', 'this lease already belongs to an account');
          }
          await tx
            .update(s.leases)
            .set({ tenantId: userId, updatedAt: new Date() })
            .where(eq(s.leases.id, lease.id));
          await tx
            .update(s.tenantInvites)
            .set({ acceptedAt: new Date(), acceptedBy: userId })
            .where(eq(s.tenantInvites.id, invite.id));
          return { propertyId: invite.propertyId, leaseId: lease.id };
        }

        const [overlap] = await tx
          .select({ id: s.leases.id })
          .from(s.leases)
          .where(
            and(
              eq(s.leases.propertyId, invite.propertyId),
              isNull(s.leases.deletedAt),
              lte(s.leases.startDate, invite.endDate),
              gte(s.leases.endDate, invite.startDate),
            ),
          )
          .limit(1);
        if (overlap) throw new ApiError('forbidden', 'the unit already has a lease in those dates');

        const leaseId = newId('lease');
        await tx.insert(s.leases).values({
          id: leaseId,
          propertyId: invite.propertyId,
          tenantId: userId,
          startDate: invite.startDate,
          endDate: invite.endDate,
          monthlyRentAgorot: invite.monthlyRentAgorot,
          depositAgorot: invite.depositAgorot,
          paymentMethod: invite.paymentMethod,
        });

        await tx
          .update(s.tenantInvites)
          .set({ acceptedAt: new Date(), acceptedBy: userId, leaseId })
          .where(eq(s.tenantInvites.id, invite.id));

        /* A lease that has already started makes the unit occupied now; a
           future one leaves today's status alone. */
        if (invite.startDate <= today()) {
          await tx
            .update(s.properties)
            .set({ status: 'occupied', listed: false, availableFrom: null, updatedAt: new Date() })
            .where(eq(s.properties.id, invite.propertyId));
        }

        return { propertyId: invite.propertyId, leaseId };
      });
    },
  );

  /** Recording a tenancy the owner already has, with no invite. */
  r.post(
    '/properties/:id/leases',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: recordLeaseSchema,
        response: { 201: recordedLeaseSchema },
      },
    },
    async (request, reply) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      requireOwner(viewer, request.params.id);
      const b = request.body;

      if (await overlappingLease(request.params.id, b.startDate, b.endDate)) {
        throw new ApiError('validation_failed', 'the unit already has a lease in those dates', {
          startDate: ['overlaps an existing lease'],
        });
      }

      const tenantId = `${OFFLINE_TENANT_PREFIX}${randomUUID().replace(/-/g, '')}`;
      const leaseId = newId('lease');

      await db.transaction(async (tx) => {
        await tx.insert(s.users).values({
          id: tenantId,
          name: b.tenantName,
          phone: b.tenantPhone ?? null,
          email: `${tenantId}@offline.invalid`,
          passwordHash: null,
        });
        await tx.insert(s.leases).values({
          id: leaseId,
          propertyId: request.params.id,
          tenantId,
          startDate: b.startDate,
          endDate: b.endDate,
          monthlyRentAgorot: toAgorot(b.monthlyRentShekels),
          depositAgorot: toAgorot(b.depositShekels),
          paymentMethod: b.paymentMethod,
          ...(b.noticePeriodDays !== undefined ? { noticePeriodDays: b.noticePeriodDays } : {}),
          hasExtensionOption: b.hasExtensionOption ?? false,
          extensionMonths: b.extensionMonths ?? null,
        });
        if (b.startDate <= today()) {
          await tx
            .update(s.properties)
            .set({ status: 'occupied', listed: false, availableFrom: null, updatedAt: new Date() })
            .where(eq(s.properties.id, request.params.id));
        }
      });

      return reply.code(201).send({ leaseId });
    },
  );
}
