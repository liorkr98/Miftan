import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, arrayContains, asc, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  deriveAvailability,
  districtOf,
  marketResponseSchema,
  searchRequestSchema,
  searchResponseSchema,
  toAgorot,
  type District,
  type SearchFilters,
  type SearchResult,
} from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { newId } from '../lib/ids.ts';

/**
 * Below this, a median is a rumour. The row still reports its demand count —
 * "nobody is letting here and forty people looked" is itself information — but
 * the price figures are withheld rather than published thin.
 */
const MINIMUM_SAMPLE = 5;

function conditions(f: SearchFilters): SQL[] {
  const where: SQL[] = [eq(s.properties.listed, true), isNull(s.properties.deletedAt)];

  if (f.district) where.push(eq(s.properties.district, f.district));
  if (f.city) where.push(eq(s.properties.city, f.city));
  if (f.neighborhood) where.push(eq(s.properties.neighborhood, f.neighborhood));

  if (f.minRooms != null) where.push(gte(s.properties.rooms, String(f.minRooms)));
  if (f.maxRooms != null) where.push(lte(s.properties.rooms, String(f.maxRooms)));
  if (f.minSqm != null) where.push(gte(s.properties.sqm, f.minSqm));
  if (f.maxSqm != null) where.push(lte(s.properties.sqm, f.maxSqm));

  if (f.minPrice != null) where.push(gte(s.properties.monthlyRentAgorot, toAgorot(f.minPrice)));
  if (f.maxPrice != null) where.push(lte(s.properties.monthlyRentAgorot, toAgorot(f.maxPrice)));

  if (f.minFloor != null) where.push(gte(s.properties.floor, f.minFloor));
  if (f.maxFloor != null) where.push(lte(s.properties.floor, f.maxFloor));

  /* Every requested amenity must be present, not any of them. `arrayContains`
     rather than a hand-written `@>`: interpolating a JS array into a raw sql
     template binds it as a scalar and the query fails at runtime. */
  if (f.amenities.length) {
    where.push(arrayContains(s.properties.amenities, f.amenities));
  }

  return where;
}

export async function searchRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * The seeker's search.
   *
   * Occupied units with a known date are included by default — that is the
   * product's whole argument, and making it opt-in would bury it.
   */
  r.post(
    '/search',
    {
      onRequest: [app.optionalAuth],
      schema: { body: searchRequestSchema, response: { 200: searchResponseSchema } },
    },
    async (request) => {
      const f = request.body.filters;
      const where = conditions(f);

      const rows = await db
        .select()
        .from(s.properties)
        .where(and(...where))
        .orderBy(
          f.sort === 'price_asc'
            ? asc(s.properties.monthlyRentAgorot)
            : f.sort === 'price_desc'
              ? desc(s.properties.monthlyRentAgorot)
              : f.sort === 'rooms'
                ? desc(s.properties.rooms)
                : f.sort === 'sqm'
                  ? desc(s.properties.sqm)
                  : asc(s.properties.availableFrom),
        );

      /* Availability needs the tenant's renewal intent, which lives on the
         lease and must never leave this function — deriveAvailability is the
         one place private intent becomes a public signal. */
      const leases = rows.length
        ? await db
            .select()
            .from(s.leases)
            .where(and(inArray(s.leases.propertyId, rows.map((p) => p.id)), isNull(s.leases.deletedAt)))
        : [];
      const intentByProperty = new Map(leases.map((l) => [l.propertyId, l.renewalIntent]));

      const queues = rows.length
        ? await db
            .select({ propertyId: s.leads.propertyId, n: sql<number>`count(*)::int` })
            .from(s.leads)
            .where(and(inArray(s.leads.propertyId, rows.map((p) => p.id)), isNull(s.leads.deletedAt)))
            .groupBy(s.leads.propertyId)
        : [];
      const queueByProperty = new Map(queues.map((q) => [q.propertyId, q.n]));

      const projected: SearchResult[] = rows.map((p) => {
        const availability = deriveAvailability({
          status: p.status,
          availableFrom: p.availableFrom,
          confidence: p.availabilityConfidence,
          renewalIntent: intentByProperty.get(p.id) ?? null,
        });
        return {
          id: p.id,
          street: p.street, houseNumber: p.houseNumber,
          city: p.city, neighborhood: p.neighborhood,
          district: (p.district as District | null) ?? null,
          lat: Number(p.lat), lng: Number(p.lng),
          rooms: Number(p.rooms), sqm: p.sqm, floor: p.floor, totalFloors: p.totalFloors,
          amenities: p.amenities, photos: p.photos,
          monthlyRentAgorot: p.monthlyRentAgorot,
          availability,
          queueLength: queueByProperty.get(p.id) ?? 0,
        };
      });

      const dateFiltered = projected.filter((p) => {
        if (!f.includeOccupied && p.availability.kind !== 'now') return false;
        if (f.confirmedOnly && p.availability.confidence !== 'confirmed') return false;
        if (f.availableFrom || f.availableBy) {
          /* A unit with no published date cannot satisfy a date constraint.
             It is not a match dressed as one. */
          if (!p.availability.date) return p.availability.kind === 'now';
          if (f.availableFrom && p.availability.date < f.availableFrom) return false;
          if (f.availableBy && p.availability.date > f.availableBy) return false;
        }
        return true;
      });

      /* Recorded after the fact, so a slow write cannot make a search slower,
         and a failed one cannot make a search fail. Analytics is never allowed
         to break the thing it is measuring. */
      if (request.body.record) {
        void recordSearch(request.currentUser?.id ?? null, f, dateFiltered.length).catch((err) => {
          request.log.warn({ err }, 'search event not recorded');
        });
      }

      return {
        results: dateFiltered,
        total: dateFiltered.length,
        /* What the same search would return without the date constraint —
           "nothing in October, four in November" is more useful than "nothing". */
        totalIgnoringDate: projected.length,
      };
    },
  );

  /**
   * What rent costs, from what we hold.
   *
   * Supply comes from the portfolio; demand from what people searched for. The
   * second half is the part that cannot be bought, and it is why a thin sample
   * still earns a row: forty searches against zero listings is the most
   * actionable fact in the table.
   */
  r.get(
    '/market',
    {
      onRequest: [app.authenticate],
      schema: {
        querystring: z.object({ district: z.string().optional() }),
        response: { 200: marketResponseSchema },
      },
    },
    async (request) => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);

      const supply = await db
        .select({
          city: s.properties.city,
          district: s.properties.district,
          rooms: s.properties.rooms,
          /* Median, not mean: one penthouse should not move a neighbourhood. */
          median: sql<number>`percentile_cont(0.5) within group (order by ${s.properties.monthlyRentAgorot})::int`,
          p25: sql<number>`percentile_cont(0.25) within group (order by ${s.properties.monthlyRentAgorot})::int`,
          p75: sql<number>`percentile_cont(0.75) within group (order by ${s.properties.monthlyRentAgorot})::int`,
          perSqm: sql<number>`percentile_cont(0.5) within group (order by (${s.properties.monthlyRentAgorot}::numeric / nullif(${s.properties.sqm}, 0)))::int`,
          n: sql<number>`count(*)::int`,
        })
        .from(s.properties)
        .where(
          and(
            isNull(s.properties.deletedAt),
            request.query.district ? eq(s.properties.district, request.query.district) : undefined,
          ),
        )
        .groupBy(s.properties.city, s.properties.district, s.properties.rooms);

      const demand = await db
        .select({
          city: s.searchEvents.city,
          n: sql<number>`count(*)::int`,
        })
        .from(s.searchEvents)
        .where(gte(s.searchEvents.at, ninetyDaysAgo))
        .groupBy(s.searchEvents.city);
      const demandByCity = new Map(demand.map((d) => [d.city ?? '', d.n]));

      const rows = supply
        .filter((row) => row.district !== null)
        .map((row) => {
          const thin = row.n < MINIMUM_SAMPLE;
          const demandCount = demandByCity.get(row.city) ?? 0;
          return {
            city: row.city,
            district: row.district as District,
            rooms: Number(row.rooms),
            /* Withheld rather than published thin. A median of two is a number
               that will be quoted back at us as though it meant something. */
            medianRentAgorot: thin ? 0 : row.median,
            p25RentAgorot: thin ? 0 : row.p25,
            p75RentAgorot: thin ? 0 : row.p75,
            medianRentPerSqmAgorot: thin ? 0 : row.perSqm,
            sampleSize: row.n,
            demandCount,
            demandPerUnit: row.n > 0 ? Number((demandCount / row.n).toFixed(2)) : null,
          };
        })
        .sort((a, b) => b.demandCount - a.demandCount || a.city.localeCompare(b.city, 'he'));

      return { rows, minimumSample: MINIMUM_SAMPLE, generatedAt: new Date().toISOString() };
    },
  );
}

async function recordSearch(seekerId: string | null, f: SearchFilters, resultCount: number) {
  await db.insert(s.searchEvents).values({
    id: newId('searchEvent'),
    seekerId,
    filters: f,
    /* Derived when the seeker filtered by city but not district, so the
       aggregate still has something to group on. */
    district: f.district ?? (f.city ? (districtOf(f.city) ?? null) : null),
    city: f.city ?? null,
    minRooms: f.minRooms != null ? String(f.minRooms) : null,
    maxRooms: f.maxRooms != null ? String(f.maxRooms) : null,
    maxPriceAgorot: f.maxPrice != null ? toAgorot(f.maxPrice) : null,
    resultCount,
  });
}
