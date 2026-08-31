import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  postThreadMessageSchema,
  startThreadSchema,
  threadListSchema,
  threadSchema,
  type ThreadView,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer, type Viewer } from '../policy/viewer.ts';

type ThreadRow = typeof s.messageThreads.$inferSelect;
type MessageRow = typeof s.threadMessages.$inferSelect;

/** Which end of the thread you are standing on. */
function sideOf(viewer: Viewer, thread: ThreadRow): 'owner' | 'counterparty' | null {
  if (thread.ownerId === viewer.userId) return 'owner';
  if (thread.counterpartyUserId === viewer.userId) return 'counterparty';
  return null;
}

function project(
  viewer: Viewer,
  thread: ThreadRow,
  messages: MessageRow[],
  ownerName: string,
  propertyLabel: string | null,
): ThreadView {
  const side = sideOf(viewer, thread)!;
  const myRole = side === 'owner' ? 'owner' : thread.counterpartyRole;
  const ordered = [...messages].sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    id: thread.id,
    subject: thread.subject,
    /* "The other person" depends on who is asking. The landlord sees the
       plumber; the plumber sees the landlord. */
    counterpartyName: side === 'owner' ? thread.counterpartyName : ownerName,
    counterpartyRole: side === 'owner' ? thread.counterpartyRole : 'owner',
    propertyId: thread.propertyId,
    propertyLabel,
    ticketId: thread.ticketId,
    leadId: thread.leadId,
    updatedAt: thread.updatedAt.toISOString(),
    /* Unread means unread by you. A message you sent is not news to you. */
    unread: ordered.filter((m) => !m.read && m.authorRole !== myRole).length,
    lastMessage: ordered.at(-1)?.body ?? null,
    messages: ordered.map((m) => ({
      id: m.id,
      authorRole: m.authorRole,
      authorName: m.authorName,
      body: m.body,
      read: m.read,
      at: m.at.toISOString(),
      mine: m.authorRole === myRole,
    })),
  };
}

export async function threadRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/threads',
    { onRequest: [app.authenticate], schema: { response: { 200: threadListSchema } } },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const rows = await db
        .select()
        .from(s.messageThreads)
        .where(
          or(
            eq(s.messageThreads.ownerId, viewer.userId),
            eq(s.messageThreads.counterpartyUserId, viewer.userId),
          ),
        )
        .orderBy(desc(s.messageThreads.updatedAt));

      const full = await projectMany(viewer, rows);
      /* The list does not carry message bodies; a mailbox does not need every
         letter opened to be drawn. */
      const threads = full.map(({ messages, ...rest }) => rest);
      return {
        threads,
        totalUnread: threads.reduce((sum, t) => sum + t.unread, 0),
      };
    },
  );

  r.get(
    '/threads/:id',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: threadSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const thread = await loadThread(viewer, request.params.id);
      const [view] = await projectMany(viewer, [thread]);
      return view;
    },
  );

  /** Only the owner opens a thread — every conversation here starts with them. */
  r.post(
    '/threads',
    {
      onRequest: [app.authenticate],
      schema: { body: startThreadSchema, response: { 201: threadSchema } },
    },
    async (request, reply) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const b = request.body;

      if (b.propertyId && !viewer.ownedPropertyIds.has(b.propertyId)) {
        throw new ApiError('not_found', 'no such property');
      }

      /* A counterparty with an account is named from it; one without — a
         plumber, usually — has to be named explicitly. */
      let name = b.counterpartyName ?? null;
      if (b.counterpartyUserId) {
        const [user] = await db
          .select({ name: s.users.name })
          .from(s.users)
          .where(eq(s.users.id, b.counterpartyUserId));
        if (!user) throw new ApiError('not_found', 'no such user');
        name = user.name;
      }
      if (!name) {
        throw new ApiError('validation_failed', 'counterparty needs a name', {
          counterpartyName: ['required when there is no account to take it from'],
        });
      }

      const id = newId('thread');
      await db.transaction(async (tx) => {
        await tx.insert(s.messageThreads).values({
          id,
          ownerId: viewer.userId,
          subject: b.subject,
          counterpartyRole: b.counterpartyRole,
          counterpartyUserId: b.counterpartyUserId ?? null,
          counterpartyName: name,
          propertyId: b.propertyId ?? null,
          ticketId: b.ticketId ?? null,
          leadId: b.leadId ?? null,
        });
        await tx.insert(s.threadMessages).values({
          id: newId('threadMessage'),
          threadId: id,
          authorRole: 'owner',
          authorName: request.currentUser!.name,
          body: b.body,
        });
      });

      const [thread] = await db.select().from(s.messageThreads).where(eq(s.messageThreads.id, id));
      const [view] = await projectMany(viewer, [thread]);
      return reply.code(201).send(view);
    },
  );

  r.post(
    '/threads/:id/messages',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: postThreadMessageSchema,
        response: { 201: threadSchema },
      },
    },
    async (request, reply) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const thread = await loadThread(viewer, request.params.id);
      const side = sideOf(viewer, thread)!;

      await db.transaction(async (tx) => {
        await tx.insert(s.threadMessages).values({
          id: newId('threadMessage'),
          threadId: thread.id,
          authorRole: side === 'owner' ? 'owner' : thread.counterpartyRole,
          authorName: request.currentUser!.name,
          body: request.body.body,
        });
        /* Sorting a mailbox by activity only works if replying counts as
           activity. */
        await tx
          .update(s.messageThreads)
          .set({ updatedAt: new Date() })
          .where(eq(s.messageThreads.id, thread.id));
      });

      const [view] = await projectMany(viewer, [thread]);
      return reply.code(201).send(view);
    },
  );

  /** Marking what the other side wrote as read. Never your own messages. */
  r.post(
    '/threads/:id/read',
    {
      onRequest: [app.authenticate],
      schema: { params: z.object({ id: z.string() }), response: { 200: threadSchema } },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const thread = await loadThread(viewer, request.params.id);
      const myRole = sideOf(viewer, thread) === 'owner' ? 'owner' : thread.counterpartyRole;

      await db
        .update(s.threadMessages)
        .set({ read: true })
        .where(
          and(
            eq(s.threadMessages.threadId, thread.id),
            /* Only the other side's. Marking your own read is meaningless and
               would corrupt the counterparty's unread count. */
            eq(s.threadMessages.authorRole, myRole === 'owner' ? thread.counterpartyRole : 'owner'),
          ),
        );

      const [view] = await projectMany(viewer, [thread]);
      return view;
    },
  );
}

/* ── helpers ─────────────────────────────────────────────── */

async function loadThread(viewer: Viewer, id: string): Promise<ThreadRow> {
  const [thread] = await db.select().from(s.messageThreads).where(eq(s.messageThreads.id, id));
  if (!thread || sideOf(viewer, thread) === null) throw new ApiError('not_found', 'no such thread');
  return thread;
}

async function projectMany(viewer: Viewer, threads: ThreadRow[]): Promise<ThreadView[]> {
  if (threads.length === 0) return [];

  const propertyIds = threads.map((t) => t.propertyId).filter((x): x is string => Boolean(x));
  const [messages, owners, properties] = await Promise.all([
    db.select().from(s.threadMessages).where(inArray(s.threadMessages.threadId, threads.map((t) => t.id))),
    db
      .select({ id: s.users.id, name: s.users.name })
      .from(s.users)
      .where(inArray(s.users.id, [...new Set(threads.map((t) => t.ownerId))])),
    propertyIds.length
      ? db.select().from(s.properties).where(inArray(s.properties.id, propertyIds))
      : Promise.resolve([]),
  ]);

  const ownerName = new Map(owners.map((u) => [u.id, u.name]));
  const label = new Map(properties.map((p) => [p.id, `${p.street} ${p.houseNumber}`]));

  return threads.map((thread) =>
    project(
      viewer,
      thread,
      messages.filter((m) => m.threadId === thread.id),
      ownerName.get(thread.ownerId) ?? '—',
      thread.propertyId ? (label.get(thread.propertyId) ?? null) : null,
    ),
  );
}
