import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  builtInTemplate,
  CONTRACT_DISCLAIMER,
  CONTRACT_TEMPLATES,
  formatAgorot,
  placeholdersIn,
  renderedSchema,
  renderTemplate,
  renderTemplateSchema,
  saveTemplateSchema,
  templateListSchema,
  templateSchema,
  type TemplateVariable,
  type TemplateView,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';
import { resolveViewer, scopeFor } from '../policy/viewer.ts';

type TemplateRow = typeof s.contractTemplates.$inferSelect;

const asView = (row: TemplateRow): TemplateView => ({
  id: row.id,
  name: row.name,
  description: row.description,
  useWhen: row.useWhen,
  body: row.body,
  variables: row.variables as TemplateVariable[],
  isBuiltIn: false,
  basedOn: row.basedOn,
});

export async function contractTemplateRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * The library: what ships with the product, plus this owner's own.
   *
   * A clone hides the built-in it came from. Showing both would be showing the
   * owner two documents with the same name and one silent difference, which is
   * how the wrong one gets signed.
   */
  r.get(
    '/contract-templates',
    { onRequest: [app.authenticate], schema: { response: { 200: templateListSchema } } },
    async (request) => {
      const mine = await db
        .select()
        .from(s.contractTemplates)
        .where(
          and(
            eq(s.contractTemplates.ownerId, request.currentUser!.id),
            eq(s.contractTemplates.archived, false),
          ),
        )
        .orderBy(asc(s.contractTemplates.createdAt));

      const overridden = new Set(mine.map((m) => m.basedOn).filter(Boolean));

      return {
        templates: [
          ...CONTRACT_TEMPLATES.filter((tpl) => !overridden.has(tpl.id)).map((tpl) => ({
            id: tpl.id,
            name: tpl.name,
            description: tpl.description,
            useWhen: tpl.useWhen,
            body: tpl.body,
            variables: tpl.variables as TemplateVariable[],
            isBuiltIn: true,
            basedOn: null,
          })),
          ...mine.map(asView),
        ],
        disclaimer: CONTRACT_DISCLAIMER,
      };
    },
  );

  /**
   * Saving one — a new template, a clone of a built-in, or an edit to a clone.
   *
   * Built-ins are never edited in place: `basedOn` pointing at one creates or
   * updates this owner's copy instead. An owner's wording cannot reach another
   * owner's document, and a future improvement to a built-in cannot silently
   * rewrite a clause somebody has been signing for a year.
   */
  r.post(
    '/contract-templates',
    {
      onRequest: [app.authenticate],
      schema: { body: saveTemplateSchema, response: { 201: templateSchema } },
    },
    async (request, reply) => {
      const ownerId = request.currentUser!.id;
      const b = request.body;

      /* Every placeholder the body uses has to be declared, or a contract goes
         out with `{{deposit}}` printed in it. */
      const declared = new Set(b.variables.map((v) => v.key));
      const undeclared = placeholdersIn(b.body).filter(
        (key) => !declared.has(key) && key !== 'signed_date',
      );
      if (undeclared.length > 0) {
        throw new ApiError('validation_failed', 'the body uses placeholders that are not declared', {
          body: undeclared.map((key) => `{{${key}}} is not in the variable list`),
        });
      }

      const existing = b.basedOn
        ? await db
            .select()
            .from(s.contractTemplates)
            .where(
              and(
                eq(s.contractTemplates.ownerId, ownerId),
                eq(s.contractTemplates.basedOn, b.basedOn),
              ),
            )
            .then((rows) => rows[0])
        : undefined;

      const id = existing?.id ?? newId('contractTemplate');
      const values = {
        ownerId,
        basedOn: b.basedOn ?? null,
        name: b.name,
        description: b.description,
        useWhen: b.useWhen,
        body: b.body,
        variables: b.variables,
        archived: false,
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(s.contractTemplates).set(values).where(eq(s.contractTemplates.id, id));
      } else {
        await db.insert(s.contractTemplates).values({ id, ...values });
      }

      const [row] = await db.select().from(s.contractTemplates).where(eq(s.contractTemplates.id, id));
      return reply.code(201).send(asView(row));
    },
  );

  /** Dropping a clone puts the built-in back. */
  r.delete(
    '/contract-templates/:id',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request) => {
      const [row] = await db
        .select()
        .from(s.contractTemplates)
        .where(
          and(
            eq(s.contractTemplates.id, request.params.id),
            eq(s.contractTemplates.ownerId, request.currentUser!.id),
          ),
        );
      if (!row) throw new ApiError('not_found', 'no such template');

      await db.delete(s.contractTemplates).where(eq(s.contractTemplates.id, row.id));
      return { ok: true as const };
    },
  );

  /**
   * Filling one in.
   *
   * A lease pre-fills what the system already knows; anything the owner typed
   * wins over it, because the stored lease can be wrong and the contract is the
   * document being signed.
   */
  r.post(
    '/contract-templates/:id/render',
    {
      onRequest: [app.authenticate],
      schema: {
        params: z.object({ id: z.string() }),
        body: renderTemplateSchema,
        response: { 200: renderedSchema },
      },
    },
    async (request) => {
      const viewer = await resolveViewer(request.currentUser!.id);
      const { id } = request.params;

      const [own] = await db
        .select()
        .from(s.contractTemplates)
        .where(and(eq(s.contractTemplates.id, id), eq(s.contractTemplates.ownerId, viewer.userId)));

      const template = own
        ? { name: own.name, body: own.body, variables: own.variables as TemplateVariable[] }
        : builtInTemplate(id);
      if (!template) throw new ApiError('not_found', 'no such template');

      const prefilled: Record<string, string> = {};

      if (request.body.leaseId) {
        const [lease] = await db
          .select()
          .from(s.leases)
          .where(and(eq(s.leases.id, request.body.leaseId), isNull(s.leases.deletedAt)));
        if (!lease) throw new ApiError('not_found', 'no such tenancy');
        if (scopeFor(viewer, lease.propertyId) !== 'owner') {
          throw new ApiError('not_found', 'no such tenancy');
        }

        const [property] = await db
          .select()
          .from(s.properties)
          .where(eq(s.properties.id, lease.propertyId));
        const [tenant] = await db
          .select({ name: s.users.name })
          .from(s.users)
          .where(eq(s.users.id, lease.tenantId));
        const [owner] = await db
          .select({ name: s.users.name })
          .from(s.users)
          .where(eq(s.users.id, viewer.userId));

        const bySource: Record<string, string> = {
          'property.address': `${property.street} ${property.houseNumber}, ${property.city}`,
          'property.rooms': String(Number(property.rooms)),
          'lease.rent': formatAgorot(lease.monthlyRentAgorot),
          'lease.deposit': formatAgorot(lease.depositAgorot),
          'lease.start': lease.startDate,
          'lease.end': lease.endDate,
          'lease.notice': String(lease.noticePeriodDays),
          'tenant.name': tenant?.name ?? '',
          'owner.name': owner?.name ?? '',
        };

        for (const variable of template.variables) {
          const value = variable.from ? bySource[variable.from] : undefined;
          if (value) prefilled[variable.key] = value;
        }
      }

      /* Typed values override the lease. The owner is looking at the paper. */
      const values: Record<string, string> = {
        signed_date: new Date().toISOString().slice(0, 10),
        ...prefilled,
        ...request.body.values,
      };

      const { text, missing } = renderTemplate(template.body, values, template.variables);

      return {
        templateId: id,
        templateName: template.name,
        text,
        missing,
        prefilled: Object.keys(prefilled).filter((key) => request.body.values[key] === undefined),
        disclaimer: CONTRACT_DISCLAIMER,
      };
    },
  );
}
