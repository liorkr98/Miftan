import * as React from 'react';
import { formatTime, israelToday, splitWindow, t, type TimeWindow } from '@miftan/shared';
import { Check, Lock, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Num } from '@/components/shared/typography';
import { cn } from '@/lib/utils';

/**
 * Scheduling, two ways round.
 *
 * `AvailabilityPicker` is how an owner says when they are free: a day and a
 * range of hours. The system cuts it into slots; nobody types "17:15".
 * `SlotGrid` is how someone else takes one of those slots. Every state is
 * carried by an icon and a word as well as colour.
 */

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'short', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

export function dayLabel(iso: string): { top: string; bottom: string } {
  const today = israelToday();
  const d = new Date(`${iso}T12:00:00Z`);
  const top = iso === today ? t.turnover.times.today : iso === addDays(today, 1) ? t.turnover.times.tomorrow : weekday.format(d);
  return { top, bottom: dayMonth.format(d) };
}

/** 07:00 … 22:00 in quarter hours. */
const TIMES = Array.from({ length: (22 - 7) * 4 + 1 }, (_, i) => {
  const m = 7 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

const PRESETS: { key: keyof typeof t.turnover.times.presets; from: string; until: string }[] = [
  { key: 'morning', from: '09:00', until: '12:00' },
  { key: 'noon', from: '12:00', until: '15:00' },
  { key: 'evening', from: '17:00', until: '20:00' },
];

function nowHHMM(): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }).format(new Date());
}

/** How many slots a window yields, counting only the ones still ahead. */
export function slotsIn(w: TimeWindow, minutes: number): number {
  const starts = splitWindow(w.from, w.until, minutes);
  if (w.date !== israelToday()) return starts.length;
  const now = nowHHMM();
  return starts.filter((s) => s > now).length;
}

export function AvailabilityPicker({
  minutes,
  value,
  onChange,
  days = 14,
}: {
  minutes: number;
  value: TimeWindow[];
  onChange: (next: TimeWindow[]) => void;
  days?: number;
}) {
  const s = t.turnover.times;
  const today = israelToday();
  const dates = React.useMemo(() => Array.from({ length: days }, (_, i) => addDays(today, i)), [today, days]);
  const [date, setDate] = React.useState(dates[1] ?? dates[0]!);
  const [from, setFrom] = React.useState('17:00');
  const [until, setUntil] = React.useState('19:00');
  const [error, setError] = React.useState<string | null>(null);

  const draft: TimeWindow = { date, from, until };
  const draftCount = from < until ? slotsIn(draft, minutes) : 0;

  const add = () => {
    if (from >= until || splitWindow(from, until, minutes).length === 0) return setError(s.tooShort);
    if (draftCount === 0) return setError(s.past);
    setError(null);
    onChange([...value.filter((w) => !(w.date === date && w.from === from && w.until === until)), draft].sort((a, b) =>
      (a.date + a.from).localeCompare(b.date + b.from),
    ));
  };

  const selectClass =
    'touch-field h-11 w-full rounded-[var(--radius-control)] border border-line bg-bg px-3 text-base text-ink num focus:border-ink focus:outline-none';

  return (
    <div className="space-y-4">
      {/* min-w-0: a fieldset will not shrink below its content by default,
          and the day strip would widen the whole sheet instead of scrolling. */}
      <fieldset className="min-w-0">
        <legend className="mb-2 text-xs font-bold text-ink-soft">{s.day}</legend>
        <div className="hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {dates.map((iso) => {
            const { top, bottom } = dayLabel(iso);
            const on = iso === date;
            const has = value.some((w) => w.date === iso);
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={on}
                onClick={() => setDate(iso)}
                className={cn(
                  'press-sm relative flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-[var(--radius-control)] border px-2 text-center',
                  on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-bg text-ink hover:border-line-strong',
                )}
              >
                <span className="text-xs font-bold">{top}</span>
                <span className="num text-2xs opacity-80">{bottom}</span>
                {has ? (
                  <span aria-hidden className={cn('absolute -top-1 end-1 h-2 w-2 rounded-full', on ? 'bg-on-ink' : 'bg-ink')} />
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setFrom(p.from);
              setUntil(p.until);
              setError(null);
            }}
            aria-pressed={from === p.from && until === p.until}
            className={cn(
              'touch-chip rounded-full border px-3 py-1.5 text-xs font-semibold',
              from === p.from && until === p.until ? 'border-ink text-ink' : 'border-line text-ink-soft hover:border-line-strong',
            )}
          >
            {s.presets[p.key]} <span className="num text-muted">{p.from}–{p.until}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-xs font-bold text-ink-soft">
          {s.from}
          <select dir="ltr" className={cn(selectClass, 'mt-1')} value={from} onChange={(e) => setFrom(e.target.value)}>
            {TIMES.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold text-ink-soft">
          {s.until}
          <select dir="ltr" className={cn(selectClass, 'mt-1')} value={until} onChange={(e) => setUntil(e.target.value)}>
            {TIMES.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" size="lg" onClick={add} className="col-span-2 sm:col-span-1">
          <Plus className="h-4 w-4" />
          {s.add}
          {draftCount > 0 ? <span className="text-xs font-semibold text-muted">· {fill(s.count, { n: draftCount })}</span> : null}
        </Button>
      </div>
      {error ? <p role="alert" className="text-xs font-semibold text-alert">{error}</p> : null}

      <div>
        <p className="mb-2 text-xs font-bold text-ink-soft">{s.chosen}</p>
        {value.length === 0 ? (
          <p className="rounded-[var(--radius-control)] border border-dashed border-line p-3 text-center text-xs text-muted">{s.empty}</p>
        ) : (
          <ul className="space-y-1.5">
            {value.map((w) => {
              const { top, bottom } = dayLabel(w.date);
              return (
                <li key={`${w.date}-${w.from}-${w.until}`} className="flex items-center gap-2 rounded-[var(--radius-control)] bg-surface px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-bold text-ink">{top}</span>{' '}
                    <span className="num text-muted">{bottom}</span> ·{' '}
                    <span className="num font-semibold text-ink">{w.from}–{w.until}</span>
                    <span className="text-xs text-muted"> · {fill(s.count, { n: slotsIn(w, minutes) })}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={s.remove}
                    onClick={() => onChange(value.filter((x) => x !== w))}
                    className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-sunk hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export interface GridSlot {
  id: string;
  startsAt: string;
  state: 'open' | 'taken' | 'mine';
}

/** Times grouped by day. A taken time stays visible — struck through and locked — so the list does not jump. */
export function SlotGrid({
  slots,
  onPick,
  pendingId,
}: {
  slots: GridSlot[];
  onPick: (id: string) => void;
  pendingId?: string | null;
}) {
  const s = t.turnover.slots;
  const byDay = new Map<string, GridSlot[]>();
  for (const slot of slots) {
    const day = israelToday(new Date(slot.startsAt));
    byDay.set(day, [...(byDay.get(day) ?? []), slot]);
  }
  if (slots.length === 0) return <p className="text-sm text-muted">{s.none}</p>;

  return (
    <div className="space-y-4">
      {[...byDay.entries()].map(([day, list]) => {
        const { top, bottom } = dayLabel(day);
        return (
          <section key={day}>
            <h4 className="mb-2 text-sm font-bold text-ink">
              {top} <span className="num font-semibold text-muted">{bottom}</span>
            </h4>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {list.map((slot) => {
                const time = formatTime(slot.startsAt);
                const taken = slot.state === 'taken';
                const mine = slot.state === 'mine';
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={taken || mine || Boolean(pendingId)}
                    onClick={() => onPick(slot.id)}
                    aria-label={taken ? `${time} · ${s.taken}` : mine ? `${time} · ${s.yours}` : time}
                    className={cn(
                      'press-sm flex min-h-12 flex-col items-center justify-center rounded-[var(--radius-control)] border px-2 py-1.5 text-center transition-colors duration-150',
                      mine && 'border-ink bg-ink text-on-ink',
                      taken && 'cursor-not-allowed border-dashed border-line bg-surface text-muted',
                      !mine && !taken && 'border-line-strong bg-bg text-ink hover:border-ink',
                      pendingId === slot.id && 'opacity-60',
                    )}
                  >
                    <Num board className={cn('text-base font-bold', taken && 'line-through')}>{time}</Num>
                    {taken ? (
                      <span className="flex items-center gap-1 text-2xs font-semibold"><Lock className="h-3 w-3" />{s.taken}</span>
                    ) : mine ? (
                      <span className="flex items-center gap-1 text-2xs font-semibold"><Check className="h-3 w-3" />{s.yours}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
