/**
 * Israel civil time. The API process used to run on UTC, so a viewing the
 * owner published for 16:00 was stored as 16:00 UTC and shown three hours
 * late in summer. These helpers name the zone instead of trusting the host.
 */

export const ISRAEL_TZ = 'Asia/Jerusalem';

/** yyyy-MM-dd in Israel, whatever the host clock is set to. */
export function israelToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** yyyy-MM in Israel. */
export function israelMonth(now: Date = new Date()): string {
  return israelToday(now).slice(0, 7);
}

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  let hour = pick('hour');
  /* Some engines report midnight as 24:00 on the same calendar day. */
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), hour, pick('minute'), pick('second'));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * A wall clock in Israel (`2026-07-15`, `14:00`) as an absolute instant.
 * 14:00 in July is 11:00 UTC; in January it is 12:00 UTC.
 */
export function zonedWallTime(date: string, time: string, timeZone: string = ISRAEL_TZ): Date {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!day || !clock) throw new Error(`bad wall time ${date} ${time}`);
  const year = Number(day[1]);
  const month = Number(day[2]);
  const dateNum = Number(day[3]);
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  let utc = Date.UTC(year, month - 1, dateNum, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const next = Date.UTC(year, month - 1, dateNum, hour, minute, 0) - offsetMinutes(new Date(utc), timeZone) * 60_000;
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}
