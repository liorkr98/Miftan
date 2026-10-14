import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  t,
  formatDateTime,
  formatTime,
  israelToday,
  passesScreening,
  type OwnerLead,
  type OwnerSlot,
  type RenewalView,
} from '@miftan/shared';
import { CalendarPlus, Check, Clock, Eye, Phone as PhoneIcon, RefreshCw, User, X } from 'lucide-react';
import { useMeetingSlotAction, useViewingAction, useViewings } from '@/api/hooks';
import { useStore } from '@/data/store';
import { dayLabel } from '@/components/shared/scheduling';
import { Phone } from '@/components/shared/typography';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, focusSheetOnTouch } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useNow } from '@/lib/use-now';
import { TimesSheet } from './turnover';

const C = t.calendar;

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** One thing on the calendar — a viewing slot or a renewal meeting slot, booked or free. */
interface CalEvent {
  id: string;
  source: 'viewing' | 'meeting';
  kind: 'viewing' | 'renewal_meeting';
  startsAt: string;
  minutes: number;
  state: 'booked' | 'open' | 'attended' | 'no_show';
  person: { name: string; phone: string | null; leadId: string | null } | null;
}

function eventsFrom(slots: OwnerSlot[], renewal: RenewalView | null): CalEvent[] {
  const viewings: CalEvent[] = slots
    .filter((s) => s.status !== 'cancelled')
    .map((s) => ({
      id: s.id,
      source: 'viewing',
      kind: 'viewing',
      startsAt: s.startsAt,
      minutes: s.durationMinutes,
      state: s.status === 'open' ? 'open' : s.status === 'attended' ? 'attended' : s.status === 'no_show' ? 'no_show' : 'booked',
      person: s.applicant ? { name: s.applicant.name, phone: s.applicant.phone ?? null, leadId: s.leadId } : null,
    }));
  const meetings: CalEvent[] = (renewal?.meetingSlots ?? [])
    .filter((m) => m.status !== 'cancelled')
    .map((m) => ({
      id: m.id,
      source: 'meeting',
      kind: 'renewal_meeting',
      startsAt: m.startsAt,
      minutes: m.durationMinutes,
      state: m.status === 'booked' ? 'booked' : 'open',
      person: m.status === 'booked' ? { name: renewal!.counterpartName, phone: null, leadId: null } : null,
    }));
  return [...viewings, ...meetings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * The property's schedule, in the property.
 *
 * Two kinds of time, told apart by shape, icon and word before colour: a
 * booked appointment is a solid card with a person's name and what it is;
 * a free time is a dashed outline that says "free". Booking, cancelling and
 * moving all happen here, and the list follows the server every few seconds,
 * so a time someone takes elsewhere stops being free here too.
 */
export function PropertyCalendar({
  propertyId,
  renewal,
  leads,
  autoAdd = false,
}: {
  propertyId: string;
  renewal: RenewalView | null;
  leads: OwnerLead[];
  autoAdd?: boolean;
}) {
  const { data } = useViewings(propertyId, { live: true });
  const slots = (data?.slots ?? []).filter((s): s is OwnerSlot => s.scope === 'owner');
  const events = eventsFrom(slots, renewal);
  const today = israelToday();
  const now = useNow();

  const [showPast, setShowPast] = React.useState(false);
  const [adding, setAdding] = React.useState(autoAdd);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const meetingMode = renewal?.stage === 'staying';
  const dayOf = (e: CalEvent) => israelToday(new Date(e.startsAt));

  /* Two weeks ahead, plus any later day that already has something on it. */
  const daySet = new Set(Array.from({ length: 14 }, (_, i) => addDays(today, i)));
  if (showPast) for (let i = 1; i <= 7; i++) daySet.add(addDays(today, -i));
  for (const e of events) daySet.add(dayOf(e));
  const days = [...daySet].filter((d) => showPast || d >= today).sort();

  const firstBusy = days.find((d) => d >= today && events.some((e) => dayOf(e) === d)) ?? today;
  const [picked, setPicked] = React.useState<string | null>(null);
  const day = picked && days.includes(picked) ? picked : firstBusy;

  const onDay = events.filter((e) => dayOf(e) === day);
  const opened = events.find((e) => e.id === openId) ?? null;
  const future = events.filter((e) => Date.parse(e.startsAt) > now);
  const futureBooked = future.filter((e) => e.state === 'booked').length;
  const futureOpen = future.filter((e) => e.state === 'open').length;

  return (
    <section aria-labelledby="calendar-title" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="calendar-title" className="text-base font-extrabold text-ink">{C.title}</h2>
          <p className="text-xs text-muted">
            {C.hint} · <span className="num">{fill(C.dayCounts, { booked: futureBooked, open: futureOpen })}</span>
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <CalendarPlus className="h-4 w-4" />
          {C.add}
        </Button>
      </div>

      {/* The two kinds of time, explained once, in the same marks the list uses. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-2xs text-ink-soft">
        <li className="flex items-center gap-1.5">
          <span className="grid h-4 w-6 place-items-center rounded-[4px] border border-ink bg-surface" aria-hidden>
            <User className="h-2.5 w-2.5 text-ink" />
          </span>
          {C.legendBooked}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="grid h-4 w-6 place-items-center rounded-[4px] border border-dashed border-line-strong" aria-hidden>
            <Clock className="h-2.5 w-2.5 text-muted" />
          </span>
          {C.legendAvailable}
        </li>
        <li className="ms-auto flex items-center gap-1 text-muted">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-open opacity-50 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-open" />
          </span>
          {C.live}
        </li>
      </ul>

      {/* Day strip. Each day says how much is booked and how much is free. */}
      <div className="hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label={C.title}>
        {days.map((d) => {
          const list = events.filter((e) => dayOf(e) === d);
          const booked = list.filter((e) => e.state !== 'open').length;
          const open = list.filter((e) => e.state === 'open' && Date.parse(e.startsAt) > now).length;
          const { top, bottom } = dayLabel(d);
          const on = d === day;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={`${top} ${bottom} · ${fill(C.dayCounts, { booked, open })}`}
              onClick={() => setPicked(d)}
              className={cn(
                'press-sm flex min-h-[4.25rem] min-w-[4rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] border px-2 text-center',
                on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-bg text-ink hover:border-line-strong',
                d < today && !on && 'opacity-70',
              )}
            >
              <span className="text-xs font-bold">{top}</span>
              <span className="num text-2xs opacity-80">{bottom}</span>
              <span className="flex items-center gap-1.5 text-2xs font-bold" aria-hidden>
                {booked ? (
                  <span className="flex items-center gap-0.5">
                    <User className="h-2.5 w-2.5" />
                    {booked}
                  </span>
                ) : null}
                {open ? (
                  <span className={cn('flex items-center gap-0.5', !on && 'text-muted')}>
                    <Clock className="h-2.5 w-2.5" />
                    {open}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <DayAgenda events={onDay} now={now} onOpen={setOpenId} />

      <button
        type="button"
        onClick={() => setShowPast((v) => !v)}
        aria-pressed={showPast}
        className="text-2xs font-bold text-ink-soft underline-offset-2 hover:underline"
      >
        {C.showPast}
      </button>

      {adding ? (
        <TimesSheet
          open
          onClose={() => setAdding(false)}
          view={renewal}
          mode={meetingMode ? 'meeting' : 'viewings'}
          propertyId={propertyId}
        />
      ) : null}

      {opened ? (
        <AppointmentSheet
          event={opened}
          events={events}
          lead={leads.find((l) => l.id === opened.person?.leadId) ?? null}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </section>
  );
}

function DayAgenda({
  events,
  now,
  onOpen,
}: {
  events: CalEvent[];
  now: number;
  onOpen: (id: string) => void;
}) {
  const viewingAction = useViewingAction();
  const meetingAction = useMeetingSlotAction();
  const pushToast = useStore((s) => s.pushToast);

  const remove = (e: CalEvent, toast = true) =>
    new Promise<void>((resolve) => {
      const opts = { onSettled: () => resolve(), onSuccess: () => (toast ? pushToast(C.removed, 'success') : undefined) };
      if (e.source === 'viewing') viewingAction.mutate({ id: e.id, action: 'cancel' }, opts);
      else meetingAction.mutate({ id: e.id, action: 'cancel' }, opts);
    });

  if (events.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center">
        <p className="text-sm font-semibold text-ink-soft">{C.empty}</p>
        <p className="mt-1 text-xs text-muted">{C.emptyHint}</p>
      </div>
    );
  }

  const freeAhead = events.filter((e) => e.state === 'open' && Date.parse(e.startsAt) > now);

  return (
    <div className="space-y-1.5">
      <ol className="space-y-1.5">
        {events.map((e) => {
          const past = Date.parse(e.startsAt) <= now;
          const KindIcon = e.kind === 'renewal_meeting' ? RefreshCw : Eye;
          if (e.state === 'open') {
            if (past) return null;
            return (
              <li key={e.id} className="flex items-stretch gap-3">
                <span className="num w-12 shrink-0 pt-2.5 text-sm font-bold text-muted">{formatTime(e.startsAt)}</span>
                <div className="flex min-h-11 flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line-strong px-3 py-1.5">
                  <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold text-ink-soft">{C.available}</span>
                    <span className="text-xs text-muted"> · {C.kinds[e.kind]}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={fill(C.removeLabel, { time: formatTime(e.startsAt) })}
                    onClick={() => void remove(e)}
                    disabled={viewingAction.isPending || meetingAction.isPending}
                    className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-sunk hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          }
          const done = e.state === 'attended' || e.state === 'no_show';
          return (
            <li key={e.id} className="flex items-stretch gap-3">
              <span className={cn('num w-12 shrink-0 pt-2.5 text-sm font-bold', past ? 'text-muted' : 'text-ink')}>
                {formatTime(e.startsAt)}
              </span>
              <button
                type="button"
                onClick={() => onOpen(e.id)}
                className={cn(
                  'flex min-h-11 flex-1 items-center gap-2.5 rounded-[var(--radius-control)] border px-3 py-2 text-start transition-colors',
                  past ? 'border-line bg-surface' : 'border-ink bg-surface hover:bg-surface-sunk',
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg ring-1 ring-line" aria-hidden>
                  <KindIcon className="h-4 w-4 text-ink" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{e.person?.name ?? '—'}</span>
                  <span className="block text-xs text-muted">{C.kinds[e.kind]}</span>
                </span>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold',
                    done ? 'bg-surface-sunk text-ink-soft' : 'bg-ink text-on-ink',
                  )}
                >
                  {e.state === 'no_show' ? <X className="h-3 w-3" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
                  {e.state === 'attended' ? C.attended : e.state === 'no_show' ? C.noShow : C.booked}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {freeAhead.length > 1 ? (
        <button
          type="button"
          onClick={async () => {
            for (const e of freeAhead) await remove(e, false);
            pushToast(C.clearedDay, 'success');
          }}
          className="text-2xs font-bold text-ink-soft underline-offset-2 hover:underline"
        >
          {C.clearDay}
        </button>
      ) : null}
    </div>
  );
}

/** One booked appointment: who, what, and the three things you might do about it. */
function AppointmentSheet({
  event,
  events,
  lead,
  onClose,
}: {
  event: CalEvent;
  events: CalEvent[];
  lead: OwnerLead | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const D = C.detail;
  const viewingAction = useViewingAction();
  const meetingAction = useMeetingSlotAction();
  const pushToast = useStore((s) => s.pushToast);
  const [moving, setMoving] = React.useState(false);
  const now = useNow();
  const name = event.person?.name ?? '';
  const past = Date.parse(event.startsAt) <= now;
  const pending = viewingAction.isPending || meetingAction.isPending;

  const free = events.filter(
    (e) => e.source === event.source && e.state === 'open' && Date.parse(e.startsAt) > now,
  );

  const cancel = (reopen: boolean) => {
    const opts = {
      onSuccess: () => {
        pushToast(fill(D.cancelled, { name }), 'success');
        onClose();
      },
    };
    if (event.source === 'viewing') viewingAction.mutate({ id: event.id, action: 'cancel', body: { reopen } }, opts);
    else meetingAction.mutate({ id: event.id, action: 'cancel', body: { reopen } }, opts);
  };

  const move = (to: CalEvent) => {
    const opts = {
      onSuccess: () => {
        pushToast(fill(D.moved, { name, date: formatDateTime(to.startsAt) }), 'success');
        onClose();
      },
      onError: () => pushToast(t.turnover.slots.gone, 'alert'),
    };
    if (event.source === 'viewing') viewingAction.mutate({ id: event.id, action: 'move', body: { toSlotId: to.id } }, opts);
    else meetingAction.mutate({ id: event.id, action: 'move', body: { toSlotId: to.id } }, opts);
  };

  const attendance = (status: 'attended' | 'no_show') =>
    viewingAction.mutate({ id: event.id, action: 'attendance', body: { status } }, { onSuccess: onClose });

  const strong = lead ? passesScreening(lead.flags) : null;

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent onOpenAutoFocus={focusSheetOnTouch}>
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-xs text-muted">{D.when}</dt>
            <dd className="num font-bold text-ink">{formatDateTime(event.startsAt)}</dd>
            <dt className="text-xs text-muted">{D.kind}</dt>
            <dd className="font-semibold text-ink">{C.kinds[event.kind]}</dd>
            {event.person?.phone ? (
              <>
                <dt className="text-xs text-muted">{D.phone}</dt>
                <dd>
                  <a href={`tel:${event.person.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-2 hover:underline">
                    <PhoneIcon className="h-3.5 w-3.5" aria-hidden />
                    <Phone value={event.person.phone} />
                  </a>
                </dd>
              </>
            ) : null}
            {strong !== null ? (
              <>
                <dt className="text-xs text-muted">{D.match}</dt>
                <dd className="flex items-center gap-1.5 font-semibold text-ink">
                  {strong ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                  {strong ? D.matchYes : D.matchNo}
                </dd>
              </>
            ) : null}
          </dl>

          {lead ? (
            <Button variant="quiet" size="sm" className="-ms-2" onClick={() => navigate(`/owner/crm?lead=${lead.id}`)}>
              {D.openApplicant}
            </Button>
          ) : null}

          {past && event.source === 'viewing' && event.state === 'booked' ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={pending} onClick={() => attendance('attended')}>
                <Check className="h-4 w-4" />
                {D.markAttended}
              </Button>
              <Button variant="quiet" loading={pending} onClick={() => attendance('no_show')}>
                {D.markNoShow}
              </Button>
            </div>
          ) : null}

          {!past && event.state === 'booked' && moving ? (
            <div>
              <p className="mb-2 text-xs text-muted">{fill(D.moveHint, { name })}</p>
              {free.length === 0 ? (
                <p className="rounded-[var(--radius-control)] bg-surface p-3 text-xs text-ink-soft">{D.noFree}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {free.map((f) => {
                    const { top } = dayLabel(israelToday(new Date(f.startsAt)));
                    return (
                      <button
                        key={f.id}
                        type="button"
                        disabled={pending}
                        onClick={() => move(f)}
                        className="press-sm flex min-h-12 flex-col items-center justify-center rounded-[var(--radius-control)] border border-line-strong px-2 py-1.5 hover:border-ink"
                      >
                        <span className="text-2xs text-muted">{top}</span>
                        <span className="num text-sm font-bold text-ink">{formatTime(f.startsAt)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {!past && event.state === 'booked' && !moving ? (
            <div className="space-y-2 rounded-[var(--radius-control)] border border-line p-3">
              <p className="text-xs font-bold text-ink">{D.cancel}</p>
              <p className="text-2xs text-muted">{fill(D.cancelHint, { name })}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" loading={pending} onClick={() => cancel(true)}>
                  <Clock className="h-3.5 w-3.5" />
                  {D.cancelReopen}
                </Button>
                <Button variant="quiet" size="sm" loading={pending} onClick={() => cancel(false)}>
                  <X className="h-3.5 w-3.5" />
                  {D.cancelRemove}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {!past && event.state === 'booked' ? (
            moving ? (
              <Button variant="secondary" size="lg" onClick={() => setMoving(false)}>
                {D.back}
              </Button>
            ) : (
              <Button size="lg" onClick={() => setMoving(true)}>
                {D.move}
              </Button>
            )
          ) : (
            <Button variant="secondary" size="lg" onClick={onClose}>
              {D.back}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
