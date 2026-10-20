import { describe, expect, it } from 'vitest';
import { israelToday, zonedWallTime } from '../lib/time';

describe('Israel time', () => {
  it('stores a summer afternoon as 11:00 UTC', () => {
    expect(zonedWallTime('2026-07-15', '14:00').toISOString()).toBe('2026-07-15T11:00:00.000Z');
  });

  it('stores a winter afternoon as 12:00 UTC', () => {
    expect(zonedWallTime('2026-01-15', '14:00').toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });

  it('reads the calendar date in Israel, not UTC', () => {
    /* 22:30 UTC on 15 July is already 16 July in Israel (UTC+3). */
    expect(israelToday(new Date('2026-07-15T22:30:00.000Z'))).toBe('2026-07-16');
    expect(israelToday(new Date('2026-07-15T18:30:00.000Z'))).toBe('2026-07-15');
  });
});
