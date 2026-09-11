import { z } from 'zod';

/**
 * Search, and the record of what was searched for.
 *
 * Every search is stored, because demand is the half of the market nobody
 * publishes. Supply data — what is listed, at what price — can be bought. What
 * people looked for and did not find cannot, and it is the more useful half:
 * it tells an owner what their unit would let for, and it tells us which areas
 * are short of what.
 *
 * What is stored is the **query**, not the person. A row carries the filters,
 * the district, how many results came back, and a coarse actor reference — not
 * a browsing history assembled into a profile. That distinction is the
 * difference between market data and a dossier, and it is why the row has no
 * free text in it.
 */

export const amenitySchema = z.enum([
  'elevator', 'parking', 'balcony', 'mamad', 'furnished',
  'ac', 'pets_allowed', 'storage', 'accessible', 'renovated',
]);

export const districtSchema = z.enum([
  'jerusalem', 'north', 'haifa', 'center', 'tel_aviv', 'south', 'judea_samaria',
]);

/**
 * The filter set. Ranges rather than single values throughout — "3 rooms" is
 * how a form is built, "3 to 4 rooms" is how a person actually looks.
 */
export const searchFiltersSchema = z.object({
  /* Where */
  district: districtSchema.nullish(),
  city: z.string().nullish(),
  neighborhood: z.string().nullish(),

  /* Size */
  minRooms: z.number().min(1).max(12).nullish(),
  maxRooms: z.number().min(1).max(12).nullish(),
  minSqm: z.number().int().min(10).max(600).nullish(),
  maxSqm: z.number().int().min(10).max(600).nullish(),

  /* Money, in shekels — this is a form, not the ledger */
  minPrice: z.number().int().min(0).max(200_000).nullish(),
  maxPrice: z.number().int().min(0).max(200_000).nullish(),

  /* Building */
  minFloor: z.number().int().min(-1).max(60).nullish(),
  maxFloor: z.number().int().min(-1).max(60).nullish(),
  amenities: z.array(amenitySchema).max(10).default([]),

  /* When — the filter that carries the product */
  availableFrom: z.string().nullish(),
  availableBy: z.string().nullish(),
  /** Occupied units with a known date. On by default; that is the whole thesis. */
  includeOccupied: z.boolean().default(true),
  /** Only units whose date is confirmed rather than projected */
  confirmedOnly: z.boolean().default(false),

  /* Tenancy shape */
  minLeaseMonths: z.number().int().min(1).max(60).nullish(),
  roommatesWelcome: z.boolean().nullish(),

  sort: z.enum(['date', 'price_asc', 'price_desc', 'rooms', 'sqm']).default('date'),
});

export const searchRequestSchema = z.object({
  filters: searchFiltersSchema,
  /** False for pagination and map panning, so one search is one row. */
  record: z.boolean().default(true),
});

/* ── What comes back ───────────────────────────────────── */

export const searchResultSchema = z.object({
  id: z.string(),
  street: z.string(),
  houseNumber: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  district: districtSchema.nullable(),
  lat: z.number(),
  lng: z.number(),
  rooms: z.number(),
  sqm: z.number().int(),
  floor: z.number().int(),
  totalFloors: z.number().int(),
  amenities: z.array(z.string()),
  photos: z.array(z.string()),
  monthlyRentAgorot: z.number().int(),
  availability: z.object({
    kind: z.enum(['now', 'dated', 'extending', 'unknown']),
    date: z.string().nullable(),
    confidence: z.enum(['confirmed', 'likely', 'unknown']),
    askable: z.boolean(),
  }),
  queueLength: z.number().int(),
});

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  total: z.number().int(),
  /** What the same filters would return with the date constraint dropped */
  totalIgnoringDate: z.number().int(),
});

/* ── The market view, built from what we hold ──────────── */

export const marketRowSchema = z.object({
  city: z.string(),
  district: districtSchema,
  rooms: z.number(),
  /** Median beats mean here: one penthouse should not move a neighbourhood */
  medianRentAgorot: z.number().int(),
  p25RentAgorot: z.number().int(),
  p75RentAgorot: z.number().int(),
  medianRentPerSqmAgorot: z.number().int(),
  /** How many units the figure rests on. Shown, always. */
  sampleSize: z.number().int(),
  /** Searches for this city and size in the last 90 days */
  demandCount: z.number().int(),
  /** Seekers per available unit — the number that says "tight" or "slack" */
  demandPerUnit: z.number().nullable(),
});

export const marketResponseSchema = z.object({
  rows: z.array(marketRowSchema),
  /** Below this a median is not published at all, only counted */
  minimumSample: z.number().int(),
  generatedAt: z.string(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type MarketRow = z.infer<typeof marketRowSchema>;
