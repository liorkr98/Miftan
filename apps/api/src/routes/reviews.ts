import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  REVIEW_WINDOW_DAYS,
  reviewListSchema,
  reviewSchema,
  writeReviewSchema,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';

/** Below this, an average identifies the reviewer as much as the reviewed. */
const MINIMUM_FOR_AVERAGE = 3;

const DAY = 86_400_000;

export async function reviewRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * Everything review-shaped about one person: what has been published about
   * them, what they have written, and which tenancies they can still write
   * about.
   *
   * The pending list is the part that makes the feature work at all. Without it
   * a review is something only the aggrieved remember to leave.
   */
  r.get(
    '/reviews',
    {
      onRequest: [app.authenticate],
      schema: {
        querystring: z.object({ userId: z.string().optional() }),
        response: { 200: reviewListSchema },
      },
    },
    async (request) => {
      const me = request.currentUser!.id;
      const subject = request.query.userId ?? me;

      /* Sweeping here rather than on a timer: the seal has to lift even if
         nothing is scheduled to lift it, and a read is the only moment we can
         be sure somebody cares. */
      await liftExpiredSeals();

      const [about, mine, pending] = await Promise.all([
        publishedAbout(subject),
        writtenBy(me),
        pendingFor(me),
      ]);

      const ratings = about.map((x) => x.rating);
      return {
        about,
        mine,
        pending,
        /* Withheld below three. With one or two, an average plus a date tells
           the subject exactly who wrote it. */
        averageRating:
          ratings.length >= MINIMUM_FOR_AVERAGE
            ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
            : null,
        reviewCount: ratings.length,
      };
    },
  );

  /**
   * Writing one.
   *
   * Refused before the tenancy is over, refused twice, and sealed on arrival.
   * Publishing happens here only when it completes a pair.
   */
  r.post(
    '/reviews',
    {
      onRequest: [app.authenticate],
      schema: { body: writeReviewSchema, response: { 201: reviewSchema } },
    },
    async (request, reply) => {
      const me = request.currentUser!.id;
      const { leaseId, rating, communication, reliability, body } = request.body;

      const [lease] = await db
        .select()
        .from(s.leases)
        .where(and(eq(s.leases.id, leaseId), isNull(s.leases.deletedAt)));
      if (!lease) throw new ApiError('not_found', 'no such tenancy');

      const [property] = await db.select().from(s.properties).where(eq(s.properties.id, lease.propertyId));

      /* Which side of it were you? */
      const authorRole =
        lease.tenantId === me ? 'tenant' : property?.ownerId === me ? 'owner' : null;
      if (!authorRole) throw new ApiError('not_found', 'no such tenancy');

      const today = new Date().toISOString().slice(0, 10);
      if (lease.endDate >= today) {
        throw new ApiError('forbidden', 'a tenancy can only be reviewed once it has ended');
      }

      const subjectId = authorRole === 'tenant' ? property.ownerId : lease.tenantId;

      const id = newId('review');
      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(s.reviews)
          .values({
            id, leaseId, authorId: me, subjectId, authorRole,
            rating,
            communication: communication ?? null,
            reliability: reliability ?? null,
            body,
          })
          /* The unique index on (lease, role) is what actually enforces one
             review per side; catching it here turns a 500 into a sentence. */
          .onConflictDoNothing()
          .returning({ id: s.reviews.id });

        if (inserted.length === 0) {
          throw new ApiError('forbidden', 'you have already reviewed this tenancy');
        }

        /* If the other side has already written, the pair is complete and both
           are released at the same instant. */
        const counterpart = await tx
          .select({ id: s.reviews.id })
          .from(s.reviews)
          .where(
            and(
              eq(s.reviews.leaseId, leaseId),
              eq(s.reviews.authorRole, authorRole === 'tenant' ? 'owner' : 'tenant'),
            ),
          );

        if (counterpart.length > 0) {
          const now = new Date();
          await tx
            .update(s.reviews)
            .set({ publishedAt: now })
            .where(and(eq(s.reviews.leaseId, leaseId), isNull(s.reviews.publishedAt)));
        }
      });

      const [row] = await db.select().from(s.reviews).where(eq(s.reviews.id, id));
      const [author] = await db
        .select({ name: s.users.name })
        .from(s.users)
        .where(eq(s.users.id, me));

      return reply.code(201).send({
        id: row.id,
        authorRole: row.authorRole,
        authorName: author.name,
        subjectId: row.subjectId,
        propertyLabel: `${property.street} ${property.houseNumber}`,
        tenancyFrom: lease.startDate,
        tenancyUntil: lease.endDate,
        rating: row.rating,
        communication: row.communication,
        reliability: row.reliability,
        body: row.body,
        /* An unpublished review still returns its own author their own text —
           they wrote it — with the creation time standing in for a publish
           time that has not happened. */
        publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
      });
    },
  );
}

/* ── helpers ─────────────────────────────────────────────── */

/**
 * Release reviews whose window has run out with no counterpart.
 *
 * Without this a tenant who reviews an unresponsive landlord is silenced by
 * the landlord simply never replying — the seal would become a veto.
 */
async function liftExpiredSeals() {
  const cutoff = new Date(Date.now() - REVIEW_WINDOW_DAYS * DAY);
  await db
    .update(s.reviews)
    .set({ publishedAt: new Date() })
    .where(and(isNull(s.reviews.publishedAt), lt(s.reviews.createdAt, cutoff)));
}

async function publishedAbout(subjectId: string) {
  const rows = await db
    .select({
      review: s.reviews,
      authorName: s.users.name,
      street: s.properties.street,
      houseNumber: s.properties.houseNumber,
      startDate: s.leases.startDate,
      endDate: s.leases.endDate,
    })
    .from(s.reviews)
    .innerJoin(s.users, eq(s.users.id, s.reviews.authorId))
    .innerJoin(s.leases, eq(s.leases.id, s.reviews.leaseId))
    .innerJoin(s.properties, eq(s.properties.id, s.leases.propertyId))
    .where(and(eq(s.reviews.subjectId, subjectId), isNotNull(s.reviews.publishedAt)))
    .orderBy(desc(s.reviews.publishedAt));

  return rows.map((x) => ({
    id: x.review.id,
    authorRole: x.review.authorRole,
    authorName: x.authorName,
    subjectId: x.review.subjectId,
    propertyLabel: `${x.street} ${x.houseNumber}`,
    tenancyFrom: x.startDate,
    tenancyUntil: x.endDate,
    rating: x.review.rating,
    communication: x.review.communication,
    reliability: x.review.reliability,
    body: x.review.body,
    publishedAt: x.review.publishedAt!.toISOString(),
  }));
}

async function writtenBy(authorId: string) {
  const rows = await db
    .select({
      review: s.reviews,
      street: s.properties.street,
      houseNumber: s.properties.houseNumber,
    })
    .from(s.reviews)
    .innerJoin(s.leases, eq(s.leases.id, s.reviews.leaseId))
    .innerJoin(s.properties, eq(s.properties.id, s.leases.propertyId))
    .where(eq(s.reviews.authorId, authorId))
    .orderBy(desc(s.reviews.createdAt));

  return rows.map((x) => ({
    id: x.review.id,
    leaseId: x.review.leaseId,
    propertyLabel: `${x.street} ${x.houseNumber}`,
    rating: x.review.rating,
    body: x.review.body,
    createdAt: x.review.createdAt.toISOString(),
    published: x.review.publishedAt !== null,
    sealedUntil:
      x.review.publishedAt === null
        ? new Date(x.review.createdAt.getTime() + REVIEW_WINDOW_DAYS * DAY).toISOString()
        : null,
  }));
}

/** Ended tenancies this person was party to and has not yet written about. */
async function pendingFor(userId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      lease: s.leases,
      street: s.properties.street,
      houseNumber: s.properties.houseNumber,
      ownerId: s.properties.ownerId,
    })
    .from(s.leases)
    .innerJoin(s.properties, eq(s.properties.id, s.leases.propertyId))
    .where(
      and(
        isNull(s.leases.deletedAt),
        lt(s.leases.endDate, today),
        or(eq(s.leases.tenantId, userId), eq(s.properties.ownerId, userId)),
      ),
    )
    .orderBy(desc(s.leases.endDate));

  if (rows.length === 0) return [];

  const written = await db
    .select({ leaseId: s.reviews.leaseId })
    .from(s.reviews)
    .where(
      and(
        eq(s.reviews.authorId, userId),
        inArray(s.reviews.leaseId, rows.map((x) => x.lease.id)),
      ),
    );
  const already = new Set(written.map((w) => w.leaseId));

  const counterpartIds = rows.map((x) => (x.lease.tenantId === userId ? x.ownerId : x.lease.tenantId));
  const people = counterpartIds.length
    ? await db
        .select({ id: s.users.id, name: s.users.name })
        .from(s.users)
        .where(inArray(s.users.id, counterpartIds))
    : [];
  const nameById = new Map(people.map((p) => [p.id, p.name]));

  return rows
    .filter((x) => !already.has(x.lease.id))
    .map((x) => {
      const myRole = x.lease.tenantId === userId ? ('tenant' as const) : ('owner' as const);
      const counterpartId = myRole === 'tenant' ? x.ownerId : x.lease.tenantId;
      /* Counted from the end of the tenancy, not from now: the deadline is a
         property of the tenancy, and a list that keeps moving its own deadline
         is not a deadline. */
      const writeBy = new Date(new Date(x.lease.endDate).getTime() + 90 * DAY);
      return {
        leaseId: x.lease.id,
        propertyLabel: `${x.street} ${x.houseNumber}`,
        counterpartName: nameById.get(counterpartId) ?? '—',
        myRole,
        tenancyFrom: x.lease.startDate,
        tenancyUntil: x.lease.endDate,
        writeBy: writeBy.toISOString().slice(0, 10),
      };
    })
    /* A tenancy that ended two years ago is not something anyone is going to
       write a useful review of. */
    .filter((x) => x.writeBy >= today);
}
