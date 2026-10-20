import {
  formatDate,
  formatMoney,
  t,
  type Amenity,
  type Criteria,
  type IntentSort,
  type SearchFilters,
  type SearchIntent,
  type SmartFilter,
} from '@miftan/shared';

export interface FormState {
  /** Tel Aviv areas; empty means all of Tel Aviv */
  areas: string[];
  minRooms: string;
  maxRooms: string;
  minSqm: string;
  maxSqm: string;
  minPrice: string;
  maxPrice: string;
  minFloor: string;
  maxFloor: string;
  availableFrom: string;
  availableBy: string;
  includeOccupied: boolean;
  confirmedOnly: boolean;
  minLeaseMonths: string;
  /** Hard requirements — the server filters on these */
  amenities: Amenity[];
  /** Soft wishes — they rank results, they never remove one */
  preferred: Amenity[];
  /** Filters computed from the system's own data, applied on the client */
  smart: SmartFilter[];
  sort: IntentSort;
}

export const EMPTY: FormState = {
  areas: [],
  minRooms: '',
  maxRooms: '',
  minSqm: '',
  maxSqm: '',
  minPrice: '',
  maxPrice: '',
  minFloor: '',
  maxFloor: '',
  availableFrom: '',
  availableBy: '',
  includeOccupied: true,
  confirmedOnly: false,
  minLeaseMonths: '',
  amenities: [],
  preferred: [],
  smart: [],
  sort: 'date',
};

const SERVER_SORTS: SearchFilters['sort'][] = ['date', 'price_asc', 'price_desc', 'rooms', 'sqm'];

export function num(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Sorts the server does not know are done here, over whatever it returned. */
export function isClientSort(sort: IntentSort): boolean {
  return !SERVER_SORTS.includes(sort as SearchFilters['sort']);
}

export function toFilters(form: FormState): SearchFilters {
  return {
    areas: form.areas,
    minRooms: num(form.minRooms),
    maxRooms: num(form.maxRooms),
    minSqm: num(form.minSqm),
    maxSqm: num(form.maxSqm),
    minPrice: num(form.minPrice),
    maxPrice: num(form.maxPrice),
    minFloor: num(form.minFloor),
    maxFloor: num(form.maxFloor),
    amenities: form.amenities,
    availableFrom: form.availableFrom || undefined,
    availableBy: form.availableBy || undefined,
    includeOccupied: form.includeOccupied,
    confirmedOnly: form.confirmedOnly,
    minLeaseMonths: num(form.minLeaseMonths),
    sort: isClientSort(form.sort) ? 'date' : (form.sort as SearchFilters['sort']),
  };
}

export function toCriteria(form: FormState): Criteria {
  return {
    areas: form.areas,
    minRooms: num(form.minRooms),
    maxRooms: num(form.maxRooms),
    minSqm: num(form.minSqm),
    maxSqm: num(form.maxSqm),
    minPrice: num(form.minPrice),
    maxPrice: num(form.maxPrice),
    minFloor: num(form.minFloor),
    maxFloor: num(form.maxFloor),
    availableFrom: form.availableFrom || undefined,
    availableBy: form.availableBy || undefined,
    required: form.amenities,
    preferred: form.preferred,
    smart: form.smart,
  };
}

const str = (n: number | undefined) => (n === undefined ? '' : String(n));

/** A free-text request replaces the filters: it is a whole new question. */
export function applyIntent(intent: SearchIntent): FormState {
  return {
    ...EMPTY,
    areas: intent.areas,
    minRooms: str(intent.minRooms),
    maxRooms: str(intent.maxRooms),
    minSqm: str(intent.minSqm),
    maxSqm: str(intent.maxSqm),
    minPrice: str(intent.minPrice),
    maxPrice: str(intent.maxPrice),
    availableFrom: intent.availableFrom ?? '',
    availableBy: intent.availableBy ?? '',
    amenities: intent.required,
    preferred: intent.preferred,
    smart: intent.smart,
    sort: intent.sort ?? 'recommended',
  };
}

export interface Chip {
  id: string;
  label: string;
  /** A wish rather than a requirement — drawn dashed */
  soft?: boolean;
  remove: (f: FormState) => FormState;
  /** Amenity chips can flip between required and preferred */
  flip?: (f: FormState) => FormState;
}

/** Wrap a number or date in an LTR isolate so it cannot reorder the Hebrew around it. */
export const ltr = (value: string | number) => `⁦${value}⁩`;

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), template);

/** The editable face of the form: whatever is set is a chip, however it got set. */
export function buildChips(form: FormState): Chip[] {
  const s = t.seeker.search;
  const chips: Chip[] = [];
  const money = (raw: string) => ltr(formatMoney(Number(raw)));

  for (const area of form.areas)
    chips.push({
      id: `area-${area}`,
      label: area,
      remove: (f) => ({ ...f, areas: f.areas.filter((x) => x !== area) }),
    });

  if (form.minPrice && form.maxPrice)
    chips.push({
      id: 'price',
      label: fill(s.chipPriceRange, { min: money(form.minPrice), max: money(form.maxPrice) }),
      remove: (f) => ({ ...f, minPrice: '', maxPrice: '' }),
    });
  else if (form.maxPrice)
    chips.push({ id: 'price', label: fill(s.chipMaxPrice, { value: money(form.maxPrice) }), remove: (f) => ({ ...f, maxPrice: '' }) });
  else if (form.minPrice)
    chips.push({ id: 'price', label: fill(s.chipMinPrice, { value: money(form.minPrice) }), remove: (f) => ({ ...f, minPrice: '' }) });

  if (form.minRooms && form.maxRooms)
    chips.push({
      id: 'rooms',
      label:
        form.minRooms === form.maxRooms
          ? t.units.rooms.replace('{n}', form.minRooms)
          : fill(s.chipRoomsRange, { min: form.minRooms, max: form.maxRooms }),
      remove: (f) => ({ ...f, minRooms: '', maxRooms: '' }),
    });
  else if (form.minRooms)
    chips.push({ id: 'rooms', label: fill(s.chipMinRooms, { value: form.minRooms }), remove: (f) => ({ ...f, minRooms: '' }) });
  else if (form.maxRooms)
    chips.push({ id: 'rooms', label: fill(s.chipMaxRooms, { value: form.maxRooms }), remove: (f) => ({ ...f, maxRooms: '' }) });

  if (form.minSqm)
    chips.push({ id: 'minSqm', label: fill(s.chipMinSqm, { value: form.minSqm }), remove: (f) => ({ ...f, minSqm: '' }) });
  if (form.maxSqm)
    chips.push({ id: 'maxSqm', label: fill(s.chipMaxSqm, { value: form.maxSqm }), remove: (f) => ({ ...f, maxSqm: '' }) });
  if (form.minFloor || form.maxFloor)
    chips.push({
      id: 'floor',
      label: fill(s.chipFloor, { min: form.minFloor || '—', max: form.maxFloor || '—' }),
      remove: (f) => ({ ...f, minFloor: '', maxFloor: '' }),
    });

  if (form.availableFrom)
    chips.push({ id: 'from', label: fill(s.chipFrom, { value: ltr(formatDate(form.availableFrom)) }), remove: (f) => ({ ...f, availableFrom: '' }) });
  if (form.availableBy)
    chips.push({ id: 'by', label: fill(s.chipBy, { value: ltr(formatDate(form.availableBy)) }), remove: (f) => ({ ...f, availableBy: '' }) });
  if (form.minLeaseMonths)
    chips.push({ id: 'lease', label: fill(s.chipLease, { value: form.minLeaseMonths }), remove: (f) => ({ ...f, minLeaseMonths: '' }) });
  if (form.confirmedOnly)
    chips.push({ id: 'confirmed', label: s.confirmedOnly, remove: (f) => ({ ...f, confirmedOnly: false }) });
  if (!form.includeOccupied)
    chips.push({ id: 'vacant', label: s.chipHideOccupied, remove: (f) => ({ ...f, includeOccupied: true }) });

  for (const a of form.amenities)
    chips.push({
      id: `req-${a}`,
      label: t.amenity[a],
      remove: (f) => ({ ...f, amenities: f.amenities.filter((x) => x !== a) }),
      flip: (f) => ({ ...f, amenities: f.amenities.filter((x) => x !== a), preferred: [...f.preferred, a] }),
    });
  for (const a of form.preferred)
    chips.push({
      id: `pref-${a}`,
      label: `${t.amenity[a]} · ${s.preferredSuffix}`,
      soft: true,
      remove: (f) => ({ ...f, preferred: f.preferred.filter((x) => x !== a) }),
      flip: (f) => ({ ...f, preferred: f.preferred.filter((x) => x !== a), amenities: [...f.amenities, a] }),
    });

  const smartLabel: Record<SmartFilter, string> = {
    below_market: s.smartBelow,
    soon: s.smartSoon,
    low_competition: s.smartLow,
  };
  for (const k of form.smart)
    chips.push({ id: `smart-${k}`, label: smartLabel[k], remove: (f) => ({ ...f, smart: f.smart.filter((x) => x !== k) }) });

  return chips;
}
