import * as React from 'react';
import { addMonths, differenceInCalendarMonths, parseISO, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { t, formatDate, formatMonthTick, formatMonthYear, formatUntil, type TrackRow } from '@miftach/shared';
import { dateRatio, trackOffset, trackSpan } from '@/lib/rtl';
import { Num, Money } from './typography';
import { EmptyState } from './empty-state';
import { CalendarRange, MoveLeft } from 'lucide-react';

/**
 * לוח היציאות — the departures board.
 *
 * One component, five contexts: the owner's whole portfolio, a single unit,
 * the tenant's own lease, a listing's availability, and the seeker's queue.
 * The axis is always the same and always reads RIGHT to LEFT, because that
 * is the direction time runs in Hebrew. Today is pinned at the start edge
 * (right); the future extends toward the end edge (left).
 *
 * Below `md` the Gantt is not squeezed — it re-renders as a month-grouped
 * list carrying the same amber date chips. A 22-row × 18-month grid on a
 * 390px screen is not a small Gantt, it's an unreadable one.
 */

const TONE_BAR: Record<TrackRow['tone'], string> = {
  signal: 'bg-signal',
  live: 'bg-live',
  open: 'bg-open',
  alert: 'bg-alert',
  muted: 'bg-line-strong',
};

const TONE_CAP: Record<TrackRow['tone'], string> = {
  signal: 'bg-signal text-ink',
  live: 'bg-live text-white',
  open: 'bg-open text-white',
  alert: 'bg-alert text-white',
  muted: 'bg-surface-sunk text-muted',
};

export interface DepartureTrackProps {
  rows: TrackRow[];
  /** How far ahead the axis reaches. Owner board = 18, a single lease = 14. */
  months?: number;
  onRowClick?: (row: TrackRow) => void;
  /** Render money on the end of each row (portfolio board) */
  showRent?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  className?: string;
  /** Compact single-row usage — tenant lease, one listing */
  dense?: boolean;
}

export function DepartureTrack({
  rows,
  months = 18,
  onRowClick,
  showRent,
  emptyTitle = t.track.empty,
  emptyHint = t.track.emptyHint,
  className,
  dense,
}: DepartureTrackProps) {
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const end = React.useMemo(() => addMonths(today, months), [today, months]);

  const ticks = React.useMemo(() => {
    const out: { at: Date; ratio: number; label: string; isYearStart: boolean }[] = [];
    let cursor = startOfMonth(addMonths(today, 1));
    while (cursor <= end) {
      out.push({
        at: cursor,
        ratio: dateRatio(cursor, today, end),
        label: formatMonthTick(cursor),
        isYearStart: cursor.getMonth() === 0,
      });
      cursor = addMonths(cursor, 1);
    }
    return out;
  }, [today, end]);

  if (rows.length === 0) {
    return <EmptyState icon={CalendarRange} title={emptyTitle} hint={emptyHint} className={className} />;
  }

  return (
    <div className={className}>
      {/* ── Desktop: the board ─────────────────────────── */}
      <div className="hidden md:block">
        <div className="mb-2 flex items-center justify-end gap-1.5 text-2xs text-muted">
          <MoveLeft className="h-3 w-3" aria-hidden />
          <span>{t.track.axisHint}</span>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
          {/* Month scale */}
          <div className="relative h-8 border-b border-line bg-surface">
            <div className="absolute inset-y-0 start-[9.5rem] end-3">
              {ticks.map((tick) => (
                <div
                  key={tick.at.toISOString()}
                  className="absolute inset-y-0 flex items-center"
                  style={trackOffset(tick.ratio)}
                >
                  <span
                    className={cn(
                      'translate-x-1/2 whitespace-nowrap px-1 text-[10px] leading-none',
                      tick.isYearStart
                        ? 'num-board font-semibold text-ink'
                        : 'font-medium text-muted',
                    )}
                  >
                    {tick.isYearStart ? tick.at.getFullYear() : tick.label}
                  </span>
                </div>
              ))}
            </div>
            {/* "today" is the right edge of the track area, not of the header */}
            <div className="absolute inset-y-0 start-[9.5rem] flex items-center">
              <span className="whitespace-nowrap rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold text-on-ink">
                {t.track.today}
              </span>
            </div>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <TrackBar
                key={row.id}
                row={row}
                today={today}
                end={end}
                ticks={ticks}
                onClick={onRowClick}
                showRent={showRent}
                dense={dense}
              />
            ))}
          </ul>
        </div>
      </div>

      {/* ── Mobile: the same facts, grouped by month ───── */}
      <MonthList rows={rows} onRowClick={onRowClick} showRent={showRent} className="md:hidden" />
    </div>
  );
}

function TrackBar({
  row,
  today,
  end,
  ticks,
  onClick,
  showRent,
  dense,
}: {
  row: TrackRow;
  today: Date;
  end: Date;
  ticks: { ratio: number; isYearStart: boolean }[];
  onClick?: (row: TrackRow) => void;
  showRent?: boolean;
  dense?: boolean;
}) {
  const until = row.until ? parseISO(row.until) : undefined;
  /* Vacant now: there is nothing to run out, so there is no bar. A full-width
     bar here would read as "occupied for the whole horizon" — the opposite of
     the truth. A pale full-width bar on any other tone is correct: occupied,
     no departure in sight. */
  const freeNow = !until && row.tone === 'open';
  const ratio = until ? Math.min(1, Math.max(0, dateRatio(until, today, end))) : 1;
  const overflows = until ? until > end : true;
  const span = trackSpan(0, ratio);
  const interactive = Boolean(onClick);

  const body = (
    <>
      <div className="flex w-[9.5rem] shrink-0 flex-col justify-center overflow-hidden pe-2 ps-3">
        <span className="truncate text-xs font-bold text-ink">{row.label}</span>
        {row.sublabel ? (
          <span className="truncate text-[10px] leading-3 text-muted">{row.sublabel}</span>
        ) : null}
      </div>

      <div className="relative flex-1 pe-3">
        {/* month gridlines */}
        <div className="pointer-events-none absolute inset-y-0 start-0 end-3">
          {ticks.map((tick, i) => (
            <div
              key={i}
              className={cn('absolute inset-y-0 w-px', tick.isYearStart ? 'bg-line-strong' : 'bg-line')}
              style={trackOffset(tick.ratio)}
            />
          ))}
        </div>

        <div className="relative h-full">
          {freeNow ? (
            <div className="absolute top-1/2 start-0 flex -translate-y-1/2 items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-open" />
              <span className="text-[10px] font-semibold text-open">{t.availability.now}</span>
            </div>
          ) : (
            <div
              className={cn(
                'absolute top-1/2 h-2 -translate-y-1/2 rounded-full transition-[width] duration-300 ease-[var(--ease-out-quint)]',
                TONE_BAR[row.tone],
                row.confidence === 'likely' && 'opacity-70',
                row.confidence === 'unknown' && 'opacity-45',
              )}
              style={span}
            />
          )}

          {/* renewal-decision mark sits ON the bar, where the deadline is */}
          {row.marks?.map((mark, i) => {
            const at = parseISO(mark.at);
            const r = dateRatio(at, today, end);
            if (r < 0 || r > 1) return null;
            return (
              <div
                key={i}
                className="absolute top-1/2 h-3.5 w-0.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
                style={trackOffset(r)}
                title={t.track.decisionPoint}
              />
            );
          })}

          {/* the departure cap — the amber date chip */}
          {until && !overflows ? (
            <div
              className="absolute top-1/2 flex -translate-y-1/2 items-center"
              style={trackOffset(ratio)}
            >
              <span
                className={cn(
                  'num-board rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                  TONE_CAP[row.tone],
                )}
              >
                {formatDate(row.until!).slice(0, 5)}
              </span>
            </div>
          ) : null}

          {!until && !freeNow ? (
            <span className="absolute top-1/2 end-1 -translate-y-1/2 text-[10px] text-muted">
              {t.track.noDate}
            </span>
          ) : null}
        </div>
      </div>

      {showRent && row.meta ? (
        <div className="w-20 shrink-0 pe-3 text-end">
          <Money value={Number(row.meta)} board className="text-[11px] text-ink-soft" />
        </div>
      ) : null}
    </>
  );

  return (
    <li className={cn(dense ? 'h-10' : 'h-11')}>
      {interactive ? (
        <button
          type="button"
          onClick={() => onClick?.(row)}
          className="flex h-full w-full items-stretch text-start transition-colors duration-150 hover:bg-surface"
        >
          {body}
        </button>
      ) : (
        <div className="flex h-full w-full items-stretch">{body}</div>
      )}
    </li>
  );
}

/** Mobile topology: months as headings, units as rows. Same data, no Gantt. */
function MonthList({
  rows,
  onRowClick,
  showRent,
  className,
}: {
  rows: TrackRow[];
  onRowClick?: (row: TrackRow) => void;
  showRent?: boolean;
  className?: string;
}) {
  const groups = React.useMemo(() => {
    const map = new Map<string, TrackRow[]>();
    const undated: TrackRow[] = [];
    for (const row of rows) {
      if (!row.until) {
        undated.push(row);
        continue;
      }
      const key = row.until.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return { dated: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])), undated };
  }, [rows]);

  const today = new Date();

  return (
    <div className={cn('space-y-4', className)}>
      {groups.dated.map(([month, monthRows]) => {
        const at = parseISO(`${month}-01`);
        /* Count down to the first real departure in the month, not to the 1st —
           "in 5 days" is wrong when the flats free up on the 28th. */
        const soonest = monthRows.reduce(
          (min, row) => (row.until && row.until < min ? row.until : min),
          monthRows[0].until!,
        );
        const away = differenceInCalendarMonths(at, today);
        return (
          <section key={month}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-line pb-1">
              <h3 className="text-xs font-bold text-ink">{formatMonthYear(at)}</h3>
              <span className="text-2xs text-muted">
                <Num>{monthRows.length}</Num> · {away < 0 ? t.ui.today : formatUntil(soonest)}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {monthRows.map((row) => (
                <MonthListRow key={row.id} row={row} onClick={onRowClick} showRent={showRent} />
              ))}
            </ul>
          </section>
        );
      })}

      {groups.undated.length > 0 ? (
        <section>
          <div className="mb-1.5 border-b border-line pb-1">
            <h3 className="text-xs font-bold text-muted">
              {groups.undated.every((r) => r.tone === 'open') ? t.availability.now : t.track.noDate}
            </h3>
          </div>
          <ul className="divide-y divide-line">
            {groups.undated.map((row) => (
              <MonthListRow key={row.id} row={row} onClick={onRowClick} showRent={showRent} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function MonthListRow({
  row,
  onClick,
  showRent,
}: {
  row: TrackRow;
  onClick?: (row: TrackRow) => void;
  showRent?: boolean;
}) {
  const content = (
    <>
      <span
        className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE_BAR[row.tone])}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{row.label}</span>
        {row.sublabel ? (
          <span className="block truncate text-2xs text-muted">{row.sublabel}</span>
        ) : null}
      </span>
      {row.until ? (
        <span
          className={cn(
            'num-board shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold',
            TONE_CAP[row.tone],
          )}
        >
          {formatDate(row.until)}
        </span>
      ) : row.tone === 'open' ? (
        <span className="shrink-0 rounded-full bg-open-soft px-2 py-0.5 text-2xs font-semibold text-open">
          {t.availability.now}
        </span>
      ) : null}
      {showRent && row.meta ? (
        <Money value={Number(row.meta)} board className="w-16 shrink-0 text-end text-2xs text-muted" />
      ) : null}
    </>
  );

  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={() => onClick(row)}
          className="flex w-full items-center gap-2.5 py-2 text-start transition-colors duration-150 active:bg-surface"
        >
          {content}
        </button>
      ) : (
        <div className="flex w-full items-center gap-2.5 py-2">{content}</div>
      )}
    </li>
  );
}
