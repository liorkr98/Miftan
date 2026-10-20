import { describe, expect, it } from 'vitest';
import { parseSearchIntent, type IntentContext } from '../lib/search-intent';
import { computeInsight, type Comparable } from '../lib/search-insight';
import { evaluateMatch, passesSmart, recommendedScore, type Criteria } from '../lib/search-rank';
import type { SearchResult } from '../api/search';

const ctx: IntentContext = { now: new Date(2026, 8, 24) };

describe('parseSearchIntent', () => {
  it('reads rooms, price, month and a required amenity in Tel Aviv', () => {
    const r = parseSearchIntent('מחפש דירת 3 חדרים בתל אביב עד 8,500 ₪, זמינה לפני דצמבר, עם מרפסת', ctx);
    expect(r.areas).toEqual([]);
    expect(r.unsupported).not.toContain('other_city');
    expect(r.minRooms).toBe(3);
    expect(r.maxRooms).toBe(3);
    expect(r.maxPrice).toBe(8500);
    expect(r.availableBy).toBe('2026-11-30');
    expect(r.required).toEqual(['balcony']);
  });

  it('reads several areas joined by "or"', () => {
    const r = parseSearchIntent('דירת 3 חדרים בפלורנטין או בלבונטין עד 8,500 ₪', ctx);
    expect(r.areas).toEqual(expect.arrayContaining(['פלורנטין', 'לבונטין']));
    expect(r.areas).toHaveLength(2);
    expect(r.minRooms).toBe(3);
    expect(r.maxPrice).toBe(8500);
  });

  it('reads the combined area as one, and either half of its name as that area', () => {
    expect(parseSearchIntent('בכרם התימנים ונווה צדק', ctx).areas).toEqual(['כרם התימנים ונווה צדק']);
    expect(parseSearchIntent('משהו בנווה צדק', ctx).areas).toEqual(['כרם התימנים ונווה צדק']);
  });

  it('reads old north, new north, east of Ibn Gabirol and the centre', () => {
    const r = parseSearchIntent('בצפון הישן, צפון החדש, מזרח אבן גבירול או מרכז העיר ולב העיר', ctx);
    expect(r.areas).toEqual(
      expect.arrayContaining(['הצפון הישן', 'הצפון החדש', 'מזרח אבן גבירול', 'מרכז העיר', 'לב העיר']),
    );
  });

  it('says so when a request names a city outside Tel Aviv', () => {
    const r = parseSearchIntent('3 חדרים ברמת גן', ctx);
    expect(r.unsupported).toContain('other_city');
    expect(r.areas).toEqual([]);
  });

  it('treats "preferably" as a preference, not a requirement', () => {
    const r = parseSearchIntent('דירה עם מרפסת, רצוי מעלית', ctx);
    expect(r.preferred).toEqual(expect.arrayContaining(['balcony', 'elevator']));
    expect(r.required).toEqual([]);
  });

  it('reads a room range and a price in thousands', () => {
    const r = parseSearchIntent('2-3 חדרים בפלורנטין עד 7.5 אלף', ctx);
    expect([r.minRooms, r.maxRooms]).toEqual([2, 3]);
    expect(r.areas).toEqual(['פלורנטין']);
    expect(r.maxPrice).toBe(7500);
  });

  it('does not mistake square metres for money', () => {
    const r = parseSearchIntent('לפחות 70 מ"ר עד 9000', ctx);
    expect(r.minSqm).toBe(70);
    expect(r.maxPrice).toBe(9000);
  });

  it('maps market comparison phrases to smart filters', () => {
    const r = parseSearchIntent('דירות מתחת לממוצע בשכונה, פחות מתחרים', ctx);
    expect(r.smart).toEqual(expect.arrayContaining(['below_market', 'low_competition']));
  });

  it('reports what it cannot filter on instead of dropping it silently', () => {
    const r = parseSearchIntent('דירה שקטה קרובה לתחבורה ציבורית', ctx);
    expect(r.unsupported).toEqual(expect.arrayContaining(['quiet', 'transit']));
    expect(r.recognized).toBe(0);
  });
});

describe('computeInsight', () => {
  const unit = (id: string, rent: number, sqm = 70, rooms = 3): Comparable => ({
    id, city: 'תל אביב-יפו', neighborhood: 'לב העיר', rooms, sqm, monthlyRentAgorot: rent * 100,
  });

  it('returns null when the peer group is too small to mean anything', () => {
    expect(computeInsight(unit('a', 8000), [unit('a', 8000), unit('b', 9000)])).toBeNull();
  });

  it('judges on rent per m² and reports the sample', () => {
    const universe = [unit('a', 7000), unit('b', 9000), unit('c', 9100), unit('d', 8900), unit('e', 9050)];
    const r = computeInsight(universe[0]!, universe)!;
    expect(r.peers).toBe(4);
    expect(r.verdict).toBe('below');
    expect(r.rentDiffAgorot).toBeLessThan(0);
    expect(r.basis).toBe('area_rooms');
    expect(r.area).toBe('לב העיר');
  });

  it('falls back to a wider group rather than inventing a narrow one', () => {
    const universe = [
      unit('a', 8000), { ...unit('b', 8000), neighborhood: 'x' }, { ...unit('c', 8000), neighborhood: 'y' },
      { ...unit('d', 8000), neighborhood: 'z' }, { ...unit('e', 8000), neighborhood: 'w' },
    ];
    expect(computeInsight(universe[0]!, universe)!.basis).toBe('city_rooms');
  });
});

describe('search-rank', () => {
  const now = new Date(2026, 8, 24);
  const row = (over: Partial<SearchResult> = {}): SearchResult => ({
    id: 'x', street: 's', houseNumber: '1', city: 'תל אביב-יפו', neighborhood: 'לב העיר', district: 'tel_aviv',
    lat: 0, lng: 0, rooms: 3, sqm: 70, floor: 2, totalFloors: 4, amenities: ['balcony'], photos: [],
    monthlyRentAgorot: 800000,
    availability: { kind: 'dated', date: '2026-10-10', confidence: 'confirmed', askable: false },
    queueLength: 0, ...over,
  });
  const none: Criteria = { areas: [], required: [], preferred: [], smart: [] };

  it('counts met criteria and names the ones that failed', () => {
    const m = evaluateMatch(row(), { ...none, maxPrice: 7000, minRooms: 3, preferred: ['elevator'] }, null, now);
    expect(m.total).toBe(3);
    expect(m.met).toBe(1);
    expect(m.missed).toHaveLength(2);
  });

  it('a smart filter with no comparison data does not pass', () => {
    expect(passesSmart(row(), null, ['below_market'], now)).toBe(false);
  });

  it('30-day and low-competition filters read real fields', () => {
    expect(passesSmart(row(), null, ['soon', 'low_competition'], now)).toBe(true);
    expect(passesSmart(row({ queueLength: 4 }), null, ['low_competition'], now)).toBe(false);
  });

  it('explains a score only with facts it used', () => {
    const { reasons } = recommendedScore(
      row({ availability: { kind: 'now', date: null, confidence: 'confirmed', askable: false } }),
      null,
      { met: 0, total: 0, missed: [] },
      now,
    );
    expect(reasons).toEqual(['now', 'low']);
  });
});

import { normalizeModelIntent } from '../lib/search-intent';

describe('normalizeModelIntent', () => {
  it('keeps what the search can use and drops everything else', () => {
    const r = normalizeModelIntent({
      areas: ['פלורנטין', 'נווה צדק', 'רמת אביב', 42],
      minRooms: 4, maxRooms: 3,
      maxPrice: '8,500',
      required: ['balcony', 'jacuzzi'],
      preferred: ['balcony', 'elevator'],
      smart: ['below_market', 'cheap'],
      unsupported: ['transit', 'aliens'],
      availableBy: '2026-11-30',
      availableFrom: 'next month',
      sort: 'whatever',
    });
    expect(r.areas).toEqual(['פלורנטין', 'כרם התימנים ונווה צדק']);
    expect([r.minRooms, r.maxRooms]).toEqual([3, 4]);
    expect(r.maxPrice).toBe(8500);
    expect(r.required).toEqual(['balcony']);
    expect(r.preferred).toEqual(['elevator']);
    expect(r.smart).toEqual(['below_market']);
    expect(r.unsupported).toEqual(['transit']);
    expect(r.availableBy).toBe('2026-11-30');
    expect(r.availableFrom).toBeUndefined();
    expect(r.sort).toBe('recommended');
  });

  it('turns garbage into an honest zero', () => {
    const r = normalizeModelIntent('not json at all');
    expect(r.recognized).toBe(0);
    expect(r.sort).toBeUndefined();
  });
});
