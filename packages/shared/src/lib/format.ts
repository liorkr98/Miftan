import { format, parseISO, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { t } from '../i18n/he';

const fill = (template: string, n: number) => template.replace('{n}', String(n));

/* ── Money ─────────────────────────────────────────────── */

const plain = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });

const precise2 = new Intl.NumberFormat('he-IL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * ₪8,900 — always rendered inside an LTR isolate by <Money>.
 *
 * `style: 'currency'` on he-IL emits "‏8,900 ‏₪" with two embedded RLM marks
 * (U+200F). Those bidi controls fight the LTR isolate the number needs and
 * render the sign on the wrong side. So the digits come from Intl (correct
 * he-IL grouping) and the sign is placed by us, in the leading position that
 * Israeli products actually use.
 */
export function formatMoney(amount: number, precise = false): string {
  const abs = Math.abs(amount);
  const digits = (precise ? precise2 : plain).format(abs);
  return `${amount < 0 ? '-' : ''}₪${digits}`;
}

/** ₪168.4K — for dense chart axes and tiles */
export function formatMoneyShort(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    const k = amount / 1000;
    const rounded = Math.abs(k) >= 100 ? Math.round(k) : Math.round(k * 10) / 10;
    return `₪${plain.format(rounded)}K`;
  }
  return `₪${plain.format(amount)}`;
}

export function formatNumber(n: number): string {
  return plain.format(n);
}

export function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
}

/* ── Dates ─────────────────────────────────────────────── */

const iso = (d: string | Date) => (typeof d === 'string' ? parseISO(d) : d);

/** dd/MM/yyyy */
export function formatDate(d: string | Date): string {
  return format(iso(d), 'dd/MM/yyyy');
}

/** dd/MM */
export function formatDateShort(d: string | Date): string {
  return format(iso(d), 'dd/MM');
}

/** dd/MM/yyyy · HH:mm */
export function formatDateTime(d: string | Date): string {
  return format(iso(d), 'dd/MM/yyyy · HH:mm');
}

export function formatTime(d: string | Date): string {
  return format(iso(d), 'HH:mm');
}

/** "ספטמבר 2026" */
export function formatMonthYear(d: string | Date): string {
  return format(iso(d), 'MMMM yyyy', { locale: he });
}

/** "ספט׳" — compact board scale */
export function formatMonthTick(d: string | Date): string {
  return format(iso(d), 'MMM', { locale: he });
}

/** "יום ג׳, 14/07" */
export function formatWeekdayDate(d: string | Date): string {
  return `${format(iso(d), 'EEEE', { locale: he })}, ${format(iso(d), 'dd/MM')}`;
}

export function daysUntil(d: string | Date, from: Date = new Date()): number {
  return differenceInCalendarDays(iso(d), from);
}

export function monthsUntil(d: string | Date, from: Date = new Date()): number {
  return differenceInCalendarMonths(iso(d), from);
}

/** "לפני 3 שעות" / "לפני יומיים" — ticket age, message age */
export function formatAge(d: string | Date, now: Date = new Date()): string {
  const then = iso(d);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return t.time.now;
  if (mins < 60) return fill(t.time.minutesAgo, mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? t.time.hourAgo : fill(t.time.hoursAgo, hours);
  const days = Math.floor(hours / 24);
  if (days === 1) return t.time.yesterday;
  if (days === 2) return t.time.twoDaysAgo;
  if (days < 30) return fill(t.time.daysAgo, days);
  const months = Math.floor(days / 30);
  if (months === 1) return t.time.monthAgo;
  if (months === 2) return t.time.twoMonthsAgo;
  if (months < 12) return fill(t.time.monthsAgo, months);
  const years = Math.floor(months / 12);
  return years === 1 ? t.time.yearAgo : fill(t.time.yearsAgo, years);
}

/** "בעוד 4 חודשים" / "בעוד 12 ימים" — countdown to a future date */
export function formatUntil(d: string | Date, from: Date = new Date()): string {
  const days = daysUntil(d, from);
  if (days < 0) return t.time.past;
  if (days === 0) return t.time.today;
  if (days === 1) return t.time.tomorrow;
  if (days < 31) return fill(t.time.inDays, days);
  const months = Math.max(1, monthsUntil(d, from));
  if (months === 1) return t.time.inMonth;
  if (months === 2) return t.time.inTwoMonths;
  if (months < 12) return fill(t.time.inMonths, months);
  return t.time.overAYear;
}

/* ── Phones ────────────────────────────────────────────── */

/** 05X-XXXXXXX */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  if (digits.length === 9 && digits.startsWith('0')) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return raw;
}

export function telHref(raw: string): string {
  return `tel:+972${raw.replace(/\D/g, '').replace(/^0/, '')}`;
}

/* ── Misc ──────────────────────────────────────────────── */

export function formatSqm(n: number): string {
  return fill(t.units.sqm, n);
}

/** "3 חד׳" — Hebrew abbreviates rooms; 2.5 stays 2.5 */
export function formatRooms(n: number): string {
  return t.units.rooms.replace('{n}', String(n));
}

export function formatFloor(floor: number, total: number): string {
  if (floor === 0) return t.units.groundFloor.replace('{total}', String(total));
  return t.units.floorOf.replace('{floor}', String(floor)).replace('{total}', String(total));
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
}

/** Expense categories span ticket categories plus fixed costs — one label
 *  lookup so neither list can leak an untranslated key into the UI. */
export function expenseCategoryLabel(key: string): string {
  const ticket = (t.ticketCategory as Record<string, string>)[key];
  if (ticket) return ticket;
  return (t.expenseCategory as Record<string, string>)[key] ?? key;
}
