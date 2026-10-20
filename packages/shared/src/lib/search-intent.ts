import type { Amenity } from '../types';
import { CITIES, TEL_AVIV, TEL_AVIV_AREAS } from '../catalog/regions';

/**
 * Free text in, filters out.
 *
 * A pure function, deliberately: it runs in the browser today, and a
 * server-side language model can replace it later without the screen changing,
 * because everything downstream only consumes a `SearchIntent`. It is rule
 * based — it recognises what it recognises and says so. Anything it cannot map
 * onto data we actually hold (quiet street, public transport) comes back in
 * `unsupported` instead of being silently dropped or pretended at.
 */

export type SmartFilter = 'below_market' | 'soon' | 'low_competition';

export type IntentSort =
  | 'date'
  | 'price_asc'
  | 'price_desc'
  | 'rooms'
  | 'sqm'
  | 'recommended'
  | 'best_match'
  | 'ppsqm';

/** Things people ask for that no column in the database can answer. */
export type UnsupportedConcept =
  | 'quiet'
  | 'transit'
  | 'schools'
  | 'view'
  | 'garden'
  | 'similar'
  | 'other_city';

export interface SearchIntent {
  /** Tel Aviv areas, by their canonical name — zero, one or several */
  areas: string[];
  minRooms?: number;
  maxRooms?: number;
  minSqm?: number;
  maxSqm?: number;
  minPrice?: number;
  maxPrice?: number;
  availableFrom?: string;
  availableBy?: string;
  required: Amenity[];
  preferred: Amenity[];
  smart: SmartFilter[];
  sort?: IntentSort;
  unsupported: UnsupportedConcept[];
  /** How many separate things were understood — zero means "try rephrasing" */
  recognized: number;
}

export interface IntentContext {
  now?: Date;
}

const H = '[א-ת]';
const START = `(?<!${H})`;
const END = `(?!${H})`;
/** Hebrew glues a preposition or article to the word: לתחבורה, במעלית, המחסן. */
const PREFIX = '[בלמהוש]?[־-]?';

const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const ROOM_WORDS: Record<string, number> = {
  שני: 2, שתי: 2, שלושה: 3, שלוש: 3, ארבעה: 4, ארבע: 4, חמישה: 5, חמש: 5, שישה: 6, שש: 6,
};

const AMENITY_WORDS: [Amenity, string][] = [
  ['balcony', 'מרפסת|גזוזטרה'],
  ['elevator', 'מעלית'],
  ['parking', 'חניה|חנייה|חניון'],
  ['mamad', 'ממ"?ד|מרחב מוגן'],
  ['furnished', 'מרוהט(?:ת|ים)?'],
  ['ac', 'מיזוג|מזגן'],
  ['pets_allowed', 'בעלי חיים|חיות|כלב|חתול'],
  ['storage', 'מחסן'],
  ['accessible', 'נגיש(?:ה|ות)?'],
  ['renovated', 'משופצ(?:ת|ות|ים)?'],
];

const UNSUPPORTED_WORDS: [UnsupportedConcept, string][] = [
  ['quiet', 'שקט(?:ה|ים|ות)?|רגוע(?:ה)?'],
  ['transit', 'תחבורה ציבורית|רכבת|אוטובוס|מטרו|רק"?ל'],
  ['schools', 'בית ספר|בתי ספר|גן ילדים|מעון'],
  ['view', 'נוף|שמש'],
  ['garden', 'גינה|חצר'],
  ['similar', 'דומה|דומות|כמו הדירה|כמו זו'],
];

const SOFT_CUE = /רצוי|עדיף|מעדיפ|אם אפשר|יתרון|בונוס/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAmount(raw: string, unit?: string): number | null {
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const value = unit && /אלף|k/i.test(unit) ? n * 1000 : n;
  return value >= 500 && value <= 200_000 ? Math.round(value) : null;
}

function roomsNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

export function parseSearchIntent(input: string, ctx: IntentContext): SearchIntent {
  const now = ctx.now ?? new Date();
  const out: SearchIntent = { areas: [], required: [], preferred: [], smart: [], unsupported: [], recognized: 0 };
  let work = ` ${input.replace(/״/g, '"').replace(/׳/g, "'").replace(/\s+/g, ' ')} `;

  /** Find, blank out so later rules cannot re-read it, and hand back the groups. */
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(work);
    if (!m) return null;
    work = work.slice(0, m.index) + ' '.repeat(m[0].length) + work.slice(m.index + m[0].length);
    return m;
  };
  const seen = () => {
    out.recognized += 1;
  };

  /* Size first: "80 מ"ר" must not be mistaken for a price. */
  const sqm = take(/(עד|מעל|לפחות|מינימום|מקסימום)?\s*(\d{2,3})\s*(?:מ"?ר|מטר(?:ים)?(?: רבוע)?)(?![א-ת])/);
  if (sqm) {
    const n = Number(sqm[2]);
    if (sqm[1] === 'עד' || sqm[1] === 'מקסימום') out.maxSqm = n;
    else out.minSqm = n;
    seen();
  }

  /* Rooms: a range, a number, or a word. "חדרי שינה" is not "חדרים" — bedrooms
     are a different count and we do not convert between them. */
  const ROOM = 'חדרים|חדר(?!י)|חד\'';
  const roomRange = take(new RegExp(`(\\d(?:[.,]\\d)?)\\s*(?:-|–|־|עד|ל)\\s*(\\d(?:[.,]\\d)?)\\s*(?:${ROOM})`));
  if (roomRange) {
    const a = roomsNumber(roomRange[1]!);
    const b = roomsNumber(roomRange[2]!);
    out.minRooms = Math.min(a, b);
    out.maxRooms = Math.max(a, b);
    seen();
  } else {
    const roomNum = take(new RegExp(`(עד|מקסימום|לפחות|מינימום|מעל)?\\s*(\\d(?:[.,]\\d)?)\\s*(?:${ROOM})`));
    if (roomNum) {
      const n = roomsNumber(roomNum[2]!);
      if (roomNum[1] === 'עד' || roomNum[1] === 'מקסימום') out.maxRooms = n;
      else if (roomNum[1]) out.minRooms = n;
      else {
        out.minRooms = n;
        out.maxRooms = n;
      }
      seen();
    } else {
      const word = take(new RegExp(`${START}(${Object.keys(ROOM_WORDS).join('|')})\\s*(?:${ROOM})`));
      if (word) {
        const n = ROOM_WORDS[word[1]!]!;
        out.minRooms = n;
        out.maxRooms = n;
        seen();
      }
    }
  }

  /* Money. */
  const UNIT = '(אלף|k|₪|שקל(?:ים)?|ש"?ח)';
  const range = take(
    new RegExp(`בין\\s*(\\d[\\d,.]*)\\s*${UNIT}?\\s*(?:ל[־-]?|ו|-|–|עד)\\s*(\\d[\\d,.]*)\\s*${UNIT}?`),
  );
  let priced = false;
  if (range) {
    const unit = range[2] ?? range[4];
    const lo = parseAmount(range[1]!, unit);
    const hi = parseAmount(range[3]!, unit);
    if (lo && hi) {
      out.minPrice = Math.min(lo, hi);
      out.maxPrice = Math.max(lo, hi);
      priced = true;
      seen();
    }
  }
  if (!priced) {
    const max = take(
      new RegExp(
        `(?:עד|מתחת\\s*ל?[־-]?|לא יותר מ[־-]?|מקסימום|תקציב(?: של)?|בתקציב(?: של)?)\\s*₪?\\s*(\\d[\\d,.]*)\\s*${UNIT}?`,
      ),
    );
    const maxValue = max ? parseAmount(max[1]!, max[2]) : null;
    if (maxValue) {
      out.maxPrice = maxValue;
      priced = true;
      seen();
    }
    const min = take(new RegExp(`(?:מעל|לפחות|מינימום|החל מ[־-]?)\\s*₪?\\s*(\\d[\\d,.]*)\\s*${UNIT}`));
    const minValue = min ? parseAmount(min[1]!, min[2]) : null;
    if (minValue) {
      out.minPrice = minValue;
      seen();
    }
    if (!priced) {
      const bare = take(new RegExp(`(?:₪\\s*(\\d[\\d,.]*)|(\\d[\\d,.]*)\\s*(?:₪|שקל(?:ים)?|ש"?ח))`));
      const bareValue = bare ? parseAmount(bare[1] ?? bare[2]!) : null;
      if (bareValue) {
        out.maxPrice = bareValue;
        seen();
      }
    }
  }

  /* Dates. */
  const monthPattern = MONTHS.join('|');
  const month = take(
    new RegExp(`${START}(לפני|עד סוף|עד|החל מ|מתחילת|מ|בתחילת|בסוף|ב|ל)?[־-]?\\s*(${monthPattern})${END}`),
  );
  if (month) {
    const prefix = month[1] ?? '';
    const index = MONTHS.indexOf(month[2]!);
    let year = now.getFullYear();
    if (new Date(year, index + 1, 0) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) year += 1;
    const first = new Date(year, index, 1);
    const last = new Date(year, index + 1, 0);
    if (prefix === 'לפני') out.availableBy = iso(addDays(first, -1));
    else if (prefix === 'עד סוף' || prefix === 'עד') out.availableBy = iso(last);
    else if (prefix === 'החל מ' || prefix === 'מתחילת' || prefix === 'מ') out.availableFrom = iso(first);
    else {
      out.availableFrom = iso(first);
      out.availableBy = iso(last);
    }
    seen();
  } else {
    const relative = take(/(?:בעוד|תוך|ב)[־-]?\s*(\d+)\s*(ימים|יום|שבועות|שבוע|חודשים|חודש)(?![א-ת])/);
    const named = relative
      ? null
      : take(/(?<![א-ת])(?:ב?חודש הקרוב|ב?חודשיים(?: הקרובים)?|ב?שבועיים)(?![א-ת])/);
    if (relative) {
      const n = Number(relative[1]);
      const unit = relative[2]!;
      const days = unit.startsWith('חוד') ? n * 30 : unit.startsWith('שבוע') ? n * 7 : n;
      out.availableBy = iso(addDays(now, days));
      seen();
    } else if (named) {
      const days = /חודשיים/.test(named[0]) ? 60 : /שבועיים/.test(named[0]) ? 14 : 30;
      out.availableBy = iso(addDays(now, days));
      seen();
    } else if (take(/(?<![א-ת])(?:מיד|מיידית|מיידי|עכשיו|פנויה עכשיו|זמינה מיד)(?![א-ת])/)) {
      out.availableBy = iso(now);
      seen();
    }
  }

  /* Areas. Any number, in any order — "פלורנטין או לבונטין" is two of them.
     Longest alias first, so "כרם התימנים ונווה צדק" is one area, not two. */
  const aliases = TEL_AVIV_AREAS.flatMap((a) => a.aliases.map((alias) => ({ alias, name: a.name }))).sort(
    (x, y) => y.alias.length - x.alias.length,
  );
  for (const { alias, name } of aliases) {
    let found = false;
    while (take(new RegExp(`${START}[בלמו]?[־-]?${escape(alias)}${END}`))) found = true;
    if (found && !out.areas.includes(name)) {
      out.areas.push(name);
      seen();
    }
  }

  /* Tel Aviv itself is the whole search, so naming it adds nothing to filter
     on. Any other city is outside what this version searches, and says so. */
  const cityAliases = CITIES.flatMap((c) => {
    const alias = c.name.includes('-') ? [c.name.split('-')[0]!] : [];
    return [c.name, ...alias].map((n) => ({ match: n, city: c.name }));
  }).sort((a, b) => b.match.length - a.match.length);
  for (const { match, city } of cityAliases) {
    if (take(new RegExp(`${START}[בלמ]?[־-]?${escape(match)}${END}`)) && city !== TEL_AVIV) {
      out.unsupported.push('other_city');
    }
  }

  /* Smart criteria — each resolves against numbers we compute, not opinions. */
  if (take(/מתחת\s*ל(?:ממוצע|מחיר\s*ה?(?:שוק|שכונה)|מחירי?\s*ה?שוק)|זול(?:ה)?\s*מה?(?:שכונה|ממוצע|שוק)|מחיר טוב/)) {
    out.smart.push('below_market');
    seen();
  }
  if (take(/(?<![א-ת])(?:זמינה בקרוב|מתפנה בקרוב|בקרוב)(?![א-ת])/)) {
    out.smart.push('soon');
    seen();
  }
  if (take(/מעט מתעניינים|פחות מתעניינים|פחות מתחרים|תחרות נמוכה|בלי תור|ללא תור|אין תור|בלי תחרות/)) {
    out.smart.push('low_competition');
    seen();
  }

  if (take(/הכי גדולה|הגדולה ביותר|הכי הרבה מטר(?:ים)?/)) {
    out.sort = 'sqm';
    seen();
  } else if (take(/הכי זולה|הזולה ביותר/)) {
    out.sort = 'price_asc';
    seen();
  } else if (take(/מחיר למטר|למ"?ר|הכי משתלמ(?:ת|ות)?|משתלמ(?:ת|ות)? ביותר|משתלמ(?:ת|ות|ים)?/)) {
    out.sort = 'ppsqm';
    seen();
  }

  /* Amenities last: by now the words for size and money are already gone. */
  const soft = SOFT_CUE.test(work);
  for (const [amenity, words] of AMENITY_WORDS) {
    if (take(new RegExp(`${START}${PREFIX}(?:${words})${END}`))) {
      (soft ? out.preferred : out.required).push(amenity);
      seen();
    }
  }

  for (const [concept, words] of UNSUPPORTED_WORDS) {
    if (new RegExp(`${START}${PREFIX}(?:${words})${END}`).test(work)) out.unsupported.push(concept);
  }

  if (out.sort === undefined && out.recognized > 0) out.sort = 'recommended';
  return out;
}

/* ── Model output, made safe ───────────────────────────── */

const AMENITY_KEYS = AMENITY_WORDS.map(([a]) => a);
const SMART_KEYS: SmartFilter[] = ['below_market', 'soon', 'low_competition'];
const SORT_KEYS: IntentSort[] = ['date', 'price_asc', 'price_desc', 'rooms', 'sqm', 'recommended', 'best_match', 'ppsqm'];
const UNSUPPORTED_KEYS: UnsupportedConcept[] = ['quiet', 'transit', 'schools', 'view', 'garden', 'similar', 'other_city'];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function pickNumber(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function pickList<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is T => typeof x === 'string' && (allowed as readonly string[]).includes(x)))];
}

/**
 * A language model's answer, reduced to what the search can actually use.
 *
 * The model is asked for this exact shape, but its output is untrusted input
 * like any other: an area that is not one of the nine, an amenity we do not
 * store, a price of minus four — each is dropped here rather than allowed to
 * reach a filter. `recognized` is recounted from what survived, so a reply
 * that was all noise comes back as zero and the screen says so.
 */
export function normalizeModelIntent(raw: unknown): SearchIntent {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const areaNames = TEL_AVIV_AREAS.map((a) => a.name) as string[];
  const aliasToName = new Map<string, string>(
    TEL_AVIV_AREAS.flatMap((a) => a.aliases.map((alias) => [alias, a.name] as [string, string])),
  );
  const areas = Array.isArray(o.areas)
    ? [
        ...new Set(
          o.areas
            .filter((x): x is string => typeof x === 'string')
            .map((x) => aliasToName.get(x.trim()) ?? x.trim())
            .filter((x) => areaNames.includes(x)),
        ),
      ]
    : [];

  let minRooms = pickNumber(o.minRooms, 1, 12);
  let maxRooms = pickNumber(o.maxRooms, 1, 12);
  if (minRooms !== undefined && maxRooms !== undefined && minRooms > maxRooms) [minRooms, maxRooms] = [maxRooms, minRooms];
  let minPrice = pickNumber(o.minPrice, 500, 200_000);
  let maxPrice = pickNumber(o.maxPrice, 500, 200_000);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  const minSqm = pickNumber(o.minSqm, 10, 600);
  const maxSqm = pickNumber(o.maxSqm, 10, 600);
  const availableFrom = typeof o.availableFrom === 'string' && ISO_DAY.test(o.availableFrom) ? o.availableFrom : undefined;
  const availableBy = typeof o.availableBy === 'string' && ISO_DAY.test(o.availableBy) ? o.availableBy : undefined;

  const required = pickList(o.required, AMENITY_KEYS);
  const preferred = pickList(o.preferred, AMENITY_KEYS).filter((a) => !required.includes(a));
  const smart = pickList(o.smart, SMART_KEYS);
  const unsupported = pickList(o.unsupported, UNSUPPORTED_KEYS);
  const sortValue = typeof o.sort === 'string' && (SORT_KEYS as string[]).includes(o.sort) ? (o.sort as IntentSort) : undefined;

  const recognized =
    areas.length +
    (minRooms !== undefined || maxRooms !== undefined ? 1 : 0) +
    (minPrice !== undefined || maxPrice !== undefined ? 1 : 0) +
    (minSqm !== undefined ? 1 : 0) +
    (maxSqm !== undefined ? 1 : 0) +
    (availableFrom || availableBy ? 1 : 0) +
    required.length +
    preferred.length +
    smart.length +
    (sortValue && sortValue !== 'recommended' ? 1 : 0);

  return {
    areas,
    minRooms: minRooms !== undefined ? Math.round(minRooms * 2) / 2 : undefined,
    maxRooms: maxRooms !== undefined ? Math.round(maxRooms * 2) / 2 : undefined,
    minSqm: minSqm !== undefined ? Math.round(minSqm) : undefined,
    maxSqm: maxSqm !== undefined ? Math.round(maxSqm) : undefined,
    minPrice: minPrice !== undefined ? Math.round(minPrice) : undefined,
    maxPrice: maxPrice !== undefined ? Math.round(maxPrice) : undefined,
    availableFrom,
    availableBy,
    required,
    preferred,
    smart,
    sort: sortValue ?? (recognized > 0 ? 'recommended' : undefined),
    unsupported,
    recognized,
  };
}
