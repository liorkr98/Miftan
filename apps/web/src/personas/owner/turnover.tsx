import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  defaultRenewedEnd,
  formatAgorot,
  formatDate,
  formatDateTime,
  MEETING_MINUTES,
  nextMoveIn,
  t,
  toShekels,
  VIEWING_MINUTES,
  type ListingRequirements,
  type OwnerProperty,
  type RenewalTopic,
  type RenewalView,
  type TimeWindow,
} from '@miftan/shared';
import { usePublishWindows, useRenewalAction } from '@/api/hooks';
import { useStore } from '@/data/store';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, focusSheetOnTouch } from '@/components/ui/dialog';
import { AvailabilityPicker, slotsIn } from '@/components/shared/scheduling';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  FileSignature,
  HelpCircle,
  LogOut,
  Search,
  Users,
} from 'lucide-react';

/**
 * The owner's side of a lease ending.
 *
 * `TurnoverPanel` sits at the top of the apartment page and always says the
 * same three things: what is happening, whether anything is needed from the
 * owner, and what happens next. Each step that needs the owner is one sheet
 * with one primary action; everything else is the system's job.
 */

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

const O = t.turnover.owner;

type Sheet = 'answers' | 'meeting' | 'viewings' | 'requirements' | 'complete' | null;

function stepIndex(v: RenewalView): number {
  if (v.stage === 'renewed' || v.stage === 'closed') return 3;
  if (v.stage === 'staying') return v.meeting ? 2 : 1;
  if (v.stage === 'leaving') return v.replacement?.viewingsBooked ? 2 : 1;
  return 0;
}

export function TurnoverPanel({
  view,
  property,
  onShowApplicants,
}: {
  view: RenewalView;
  property: OwnerProperty;
  onShowApplicants: () => void;
}) {
  const action = useRenewalAction();
  const pushToast = useStore((s) => s.pushToast);
  const [sheet, setSheet] = React.useState<Sheet>(null);
  const tenant = view.counterpartName;
  const r = view.replacement;

  let Icon: React.ComponentType<{ className?: string }> = Clock3;
  let title = '';
  let hint: React.ReactNode = null;
  let primary: { label: string; onClick: () => void; pending?: boolean } | null = null;
  let secondary: { label: string; onClick: () => void; pending?: boolean } | null = null;

  switch (view.stage) {
    case 'upcoming':
      Icon = CalendarClock;
      title = fill(O.upcoming, { tenant, end: formatDate(view.lease.endDate), opens: formatDate(view.opensOn) });
      secondary = {
        label: O.askNow,
        pending: action.isPending,
        onClick: () => action.mutate({ leaseId: view.leaseId, action: 'open' }),
      };
      break;
    case 'awaiting_tenant':
    case 'answered':
      if (view.overdue) {
        Icon = HelpCircle;
        title = fill(O.overdueTitle, { tenant, by: formatDate(view.answerBy) });
        hint = O.overdueHint;
        primary = {
          label: O.giveMoreTime,
          pending: action.isPending,
          onClick: () => action.mutate({ leaseId: view.leaseId, action: 'deadline', body: { days: 3 } }),
        };
        secondary = {
          label: O.startSearch,
          onClick: () => action.mutate({ leaseId: view.leaseId, action: 'decision', body: { decision: 'leave' } }),
        };
      } else {
        title = fill(view.stage === 'answered' ? O.waitingFinal : O.waitingTenant, { tenant });
        hint = fill(view.stage === 'answered' ? O.waitingFinalHint : O.waitingTenantHint, {
          by: view.stage === 'answered' ? formatDateTime(view.answerBy) : formatDate(view.answerBy),
        });
      }
      break;
    case 'questions':
      Icon = HelpCircle;
      title = fill(O.questionsTitle, { tenant });
      hint = (
        <ul className="mt-1 space-y-1">
          {view.questions.map((q, i) => (
            <li key={i} className="text-sm text-ink">· {q.topic === 'other' ? q.text : t.turnover.topics[q.topic]}</li>
          ))}
        </ul>
      );
      primary = { label: O.answer, onClick: () => setSheet('answers') };
      break;
    case 'staying':
      if (view.meeting) {
        Icon = FileSignature;
        title = fill(O.meetingTitle, { date: formatDateTime(view.meeting.startsAt) });
        hint = fill(O.meetingHint, { tenant });
        primary = { label: O.markRenewed, onClick: () => setSheet('complete') };
      } else if (view.waitingOn === 'tenant_time') {
        title = fill(O.waitingPick, { tenant });
        hint = fill(O.waitingPickHint, { n: view.meetingSlots.filter((x) => x.status === 'open').length });
        secondary = { label: O.addTimes, onClick: () => setSheet('meeting') };
      } else {
        Icon = CheckCircle2;
        title = fill(O.stayingTitle, { tenant });
        hint = fill(O.stayingHint, { tenant });
        primary = { label: O.offerTimes, onClick: () => setSheet('meeting') };
      }
      break;
    case 'leaving':
      if (view.ownerStep === 'review_requirements') {
        Icon = LogOut;
        title = fill(O.leavingTitle, { tenant, date: formatDate(view.moveOutDate ?? view.lease.endDate) });
        hint = (
          <>
            <span className="block">{O.leavingHint}</span>
            {r ? <span className="mt-1 block text-xs text-muted">{fill(O.autoStart, { date: formatDateTime(r.applicantsOpenAt) })}</span> : null}
          </>
        );
        primary = { label: O.reviewRequirements, onClick: () => setSheet('requirements') };
      } else {
        Icon = Search;
        title = fill(O.searchTitle, { date: formatDate(nextMoveIn(view.moveOutDate ?? view.lease.endDate)) });
        hint = r ? (
          <>
            <span className="block">
              {r.applicants > 0
                ? fill(O.searchStats, { applicants: r.applicants, strong: r.strongMatches })
                : fill(O.searchEmpty, { watchers: r.watchersInvited })}
            </span>
            {r.viewingSlotsFuture > 0 ? (
              <span className="mt-1 block text-xs text-muted">
                {fill(O.viewingsStat, { booked: r.viewingsBooked, open: r.viewingSlotsFuture - r.viewingsBooked })}
              </span>
            ) : null}
          </>
        ) : null;
        if (view.ownerStep === 'set_viewing_times') primary = { label: O.setViewings, onClick: () => setSheet('viewings') };
        if (view.ownerStep === 'review_applicants') {
          primary = { label: O.viewApplicants, onClick: onShowApplicants };
          secondary = { label: O.addTimes, onClick: () => setSheet('viewings') };
        }
        if (!view.ownerStep) secondary = { label: O.setViewings, onClick: () => setSheet('viewings') };
      }
      break;
    case 'renewed':
      Icon = CheckCircle2;
      title = fill(O.renewedTitle, { date: formatDate(view.newEndDate ?? view.lease.endDate) });
      break;
    case 'closed':
      Icon = CheckCircle2;
      title = O.closedTitle;
      break;
  }

  const needsOwner = Boolean(view.ownerStep);

  return (
    <section
      aria-label={O.panelTitle}
      className={cn(
        'rounded-[var(--radius-card)] border p-4 sm:p-5',
        needsOwner ? 'border-ink bg-bg' : 'border-line bg-surface',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted">{O.panelTitle}</span>
        <Stepper index={stepIndex(view)} />
      </div>

      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-6 w-6 shrink-0', needsOwner ? 'text-ink' : 'text-muted')} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold leading-7 text-ink">{title}</h2>
          {hint ? <div className="mt-1 text-sm leading-6 text-ink-soft">{hint}</div> : null}
          {primary || secondary ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {primary ? (
                <Button size="lg" loading={primary.pending} onClick={primary.onClick} className="max-sm:w-full">
                  {primary.label}
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : null}
              {secondary ? (
                <Button size="lg" variant="secondary" loading={secondary.pending} onClick={secondary.onClick} className="max-sm:w-full">
                  {secondary.label}
                </Button>
              ) : null}
            </div>
          ) : null}
          {view.stage === 'leaving' && !r?.applicantsOpen ? (
            <button
              type="button"
              onClick={() =>
                action.mutate(
                  { leaseId: view.leaseId, action: 'decision', body: { decision: 'stay' } },
                  { onSuccess: () => pushToast(t.turnover.tenant.decided, 'success') },
                )
              }
              className="mt-3 text-xs font-semibold text-muted underline underline-offset-4 hover:text-ink"
            >
              {O.tenantStaysAfterAll}
            </button>
          ) : null}
        </div>
      </div>

      {/* Mounted only while open, so each starts from the current facts. */}
      {sheet === 'answers' ? <AnswersSheet open onClose={() => setSheet(null)} view={view} /> : null}
      {sheet === 'meeting' ? <TimesSheet open onClose={() => setSheet(null)} view={view} mode="meeting" propertyId={property.id} /> : null}
      {sheet === 'viewings' ? <TimesSheet open onClose={() => setSheet(null)} view={view} mode="viewings" propertyId={property.id} /> : null}
      {sheet === 'requirements' ? <RequirementsSheet open onClose={() => setSheet(null)} view={view} property={property} /> : null}
      {sheet === 'complete' ? <CompleteSheet open onClose={() => setSheet(null)} view={view} /> : null}
    </section>
  );
}

function Stepper({ index }: { index: number }) {
  const labels = [O.steps.decision, O.steps.path, O.steps.finish];
  return (
    <ol className="flex items-center gap-1.5" aria-label={O.panelTitle}>
      {labels.map((label, i) => {
        const done = i < index;
        const current = i === index;
        return (
          <li key={label} className="flex items-center gap-1.5">
            <span
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold',
                done && 'bg-surface-sunk text-ink-soft',
                current && 'bg-ink text-on-ink',
                !done && !current && 'text-muted',
              )}
            >
              {done ? <Check className="h-3 w-3" aria-hidden /> : null}
              <span className={cn(!current && 'max-sm:sr-only')}>{label}</span>
            </span>
            {i < labels.length - 1 ? <span aria-hidden className="h-px w-3 bg-line-strong" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Sheets ───────────────────────────────────────────── */

function AnswersSheet({ open, onClose, view }: { open: boolean; onClose: () => void; view: RenewalView }) {
  const action = useRenewalAction();
  const pushToast = useStore((s) => s.pushToast);
  const A = t.turnover.answers;
  const [answers, setAnswers] = React.useState<Record<number, string>>({});
  const [deadline, setDeadline] = React.useState<'h24' | 'd3' | 'd7' | 'custom'>('d3');
  const [custom, setCustom] = React.useState('');
  const [missing, setMissing] = React.useState(false);

  const deadlineIso = () => {
    const now = Date.now();
    if (deadline === 'custom') return custom ? new Date(`${custom}T23:59:00`).toISOString() : '';
    const hours = deadline === 'h24' ? 24 : deadline === 'd3' ? 72 : 168;
    return new Date(now + hours * 3_600_000).toISOString();
  };

  const send = () => {
    const list = view.questions.map((q, i) => ({ topic: q.topic, answer: (answers[i] ?? '').trim() }));
    if (list.some((a) => !a.answer) || !deadlineIso()) return setMissing(true);
    action.mutate(
      { leaseId: view.leaseId, action: 'answers', body: { answers: list, deadline: deadlineIso() } },
      { onSuccess: () => { pushToast(A.sent, 'success'); onClose(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent onOpenAutoFocus={focusSheetOnTouch}>
        <DialogHeader>
          <DialogTitle>{fill(A.title, { tenant: view.counterpartName })}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <p className="rounded-[var(--radius-control)] bg-surface p-3 text-xs text-ink-soft">
            {fill(A.leaseNow, { rent: formatAgorot(view.lease.monthlyRentAgorot), end: formatDate(view.lease.endDate) })}
          </p>
          {view.questions.map((q, i) => {
            const quick = A.quick[q.topic as RenewalTopic] ?? [];
            return (
              <div key={i} className="space-y-2">
                <p className="text-base font-bold text-ink">{q.topic === 'other' ? q.text : t.turnover.topics[q.topic]}</p>
                {quick.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {quick.map((label) => (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={answers[i] === label}
                        onClick={() => setAnswers((a) => ({ ...a, [i]: label }))}
                        className={cn(
                          'touch-chip rounded-full border px-3 py-1.5 text-sm font-semibold',
                          answers[i] === label ? 'border-ink bg-ink text-on-ink' : 'border-line-strong text-ink hover:border-ink',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Textarea
                  id={`answer-${i}`}
                  aria-label={A.own}
                  value={answers[i] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                  placeholder={quick.length ? A.own : A.ownPlaceholder}
                  className="min-h-14"
                />
              </div>
            );
          })}

          <fieldset className="min-w-0 space-y-2 border-t border-line pt-4">
            <legend className="text-base font-bold text-ink">{fill(A.deadlineTitle, { tenant: view.counterpartName })}</legend>
            <div className="flex flex-wrap gap-1.5">
              {(['h24', 'd3', 'd7', 'custom'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={deadline === k}
                  onClick={() => setDeadline(k)}
                  className={cn(
                    'touch-chip rounded-full border px-3.5 py-1.5 text-sm font-semibold',
                    deadline === k ? 'border-ink bg-ink text-on-ink' : 'border-line-strong text-ink hover:border-ink',
                  )}
                >
                  {A.deadline[k]}
                </button>
              ))}
            </div>
            {deadline === 'custom' ? (
              <Input id="answer-deadline" type="date" dir="ltr" className="num max-w-48" value={custom} onChange={(e) => setCustom(e.target.value)} />
            ) : null}
          </fieldset>
          {missing ? <p role="alert" className="text-sm font-semibold text-alert">{A.missing}</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button size="lg" loading={action.isPending} onClick={send}>{A.send}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimesSheet({
  open,
  onClose,
  view,
  mode,
  propertyId,
}: {
  open: boolean;
  onClose: () => void;
  view: RenewalView;
  mode: 'meeting' | 'viewings';
  propertyId: string;
}) {
  const action = useRenewalAction();
  const publish = usePublishWindows();
  const pushToast = useStore((s) => s.pushToast);
  const S = t.turnover.times;
  const [windows, setWindows] = React.useState<TimeWindow[]>([]);
  const minutes = mode === 'meeting' ? MEETING_MINUTES : VIEWING_MINUTES;
  const total = windows.reduce((n, w) => n + slotsIn(w, minutes), 0);

  const submit = () => {
    const done = () => {
      pushToast(mode === 'meeting' ? S.sentMeeting : S.sentViewings, 'success');
      onClose();
    };
    if (mode === 'meeting') {
      action.mutate({ leaseId: view.leaseId, action: 'meeting-slots', body: { windows } }, { onSuccess: done });
    } else {
      publish.mutate({ propertyId, windows }, { onSuccess: done });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent onOpenAutoFocus={focusSheetOnTouch}>
        <DialogHeader>
          <DialogTitle>{mode === 'meeting' ? S.meetingTitle : S.viewingsTitle}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm leading-6 text-ink-soft">
            {fill(mode === 'meeting' ? S.meetingHint : S.viewingsHint, { tenant: view.counterpartName })}
          </p>
          <AvailabilityPicker minutes={minutes} value={windows} onChange={setWindows} />
        </DialogBody>
        <DialogFooter>
          <Button size="lg" disabled={total === 0} loading={action.isPending || publish.isPending} onClick={submit}>
            {mode === 'meeting' ? fill(S.submitMeeting, { tenant: view.counterpartName }) : fill(S.submitViewings, { n: total })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Segmented control: two or three answers, one tap, state shown with a tick as well as fill. */
function Segments<V extends string | number | boolean | null>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'touch-chip flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold',
              on ? 'border-ink bg-ink text-on-ink' : 'border-line-strong text-ink hover:border-ink',
            )}
          >
            {on ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RequirementsSheet({
  open,
  onClose,
  view,
  property,
}: {
  open: boolean;
  onClose: () => void;
  view: RenewalView;
  property: OwnerProperty;
}) {
  const action = useRenewalAction();
  const pushToast = useStore((s) => s.pushToast);
  const R = t.turnover.requirements;

  const initial = React.useMemo(
    () => ({
      monthlyRent: toShekels(property.monthlyRentAgorot),
      availableFrom: property.availability.date ?? nextMoveIn(view.moveOutDate ?? view.lease.endDate),
      minLeaseMonths: property.minLeaseMonths,
      maxOccupants: property.maxOccupants,
      petsAllowed: property.amenities.includes('pets_allowed'),
      smokingAllowed: property.smokingAllowed,
      furnished: property.amenities.includes('furnished'),
    }),
    [property, view],
  );
  const [v, setV] = React.useState(initial);

  const changes: ListingRequirements = {};
  (Object.keys(initial) as (keyof typeof initial)[]).forEach((k) => {
    if (v[k] !== initial[k]) (changes as Record<string, unknown>)[k] = v[k];
  });
  const changed = Object.keys(changes).length > 0;
  const mark = (k: keyof typeof initial) =>
    v[k] !== initial[k] ? <span className="ms-2 rounded-full bg-surface-sunk px-2 py-0.5 text-2xs font-bold text-ink-soft">{R.changed}</span> : null;

  const go = () =>
    action.mutate(
      { leaseId: view.leaseId, action: 'requirements', body: changes },
      { onSuccess: () => { pushToast(R.started, 'success'); onClose(); } },
    );

  const row = (k: keyof typeof initial, label: string, control: React.ReactNode) => (
    <div className="space-y-1.5 border-b border-line pb-4 last:border-0">
      <p className="text-sm font-bold text-ink">{label}{mark(k)}</p>
      {control}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent onOpenAutoFocus={focusSheetOnTouch}>
        <DialogHeader>
          <DialogTitle>{R.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-ink-soft">{R.hint}</p>
          {row('monthlyRent', R.rent, (
            <div className="flex items-center gap-2">
              <span className="text-muted">₪</span>
              <Input id="req-rent" type="number" inputMode="numeric" dir="ltr" className="num max-w-40" value={v.monthlyRent}
                onChange={(e) => setV((x) => ({ ...x, monthlyRent: Number(e.target.value) || 0 }))} />
            </div>
          ))}
          {row('availableFrom', R.moveIn, (
            <Input id="req-movein" type="date" dir="ltr" className="num max-w-48" value={v.availableFrom}
              onChange={(e) => setV((x) => ({ ...x, availableFrom: e.target.value }))} />
          ))}
          {row('minLeaseMonths', R.lease, (
            <Segments label={R.lease} value={v.minLeaseMonths} onChange={(n) => setV((x) => ({ ...x, minLeaseMonths: n }))}
              options={[{ value: null, label: R.noMatter }, { value: 6, label: '6' }, { value: 12, label: '12' }, { value: 24, label: '24' }]} />
          ))}
          {row('maxOccupants', R.occupants, (
            <Segments label={R.occupants} value={v.maxOccupants} onChange={(n) => setV((x) => ({ ...x, maxOccupants: n }))}
              options={[{ value: null, label: R.noMatter }, ...[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))]} />
          ))}
          {row('petsAllowed', R.pets, (
            <Segments label={R.pets} value={v.petsAllowed} onChange={(b) => setV((x) => ({ ...x, petsAllowed: b }))}
              options={[{ value: true, label: R.allowed }, { value: false, label: R.notAllowed }]} />
          ))}
          {row('smokingAllowed', R.smoking, (
            <Segments label={R.smoking} value={v.smokingAllowed} onChange={(b) => setV((x) => ({ ...x, smokingAllowed: b }))}
              options={[{ value: true, label: R.allowed }, { value: false, label: R.notAllowed }, { value: null, label: R.noMatter }]} />
          ))}
          {row('furnished', R.furnished, (
            <Segments label={R.furnished} value={v.furnished} onChange={(b) => setV((x) => ({ ...x, furnished: b }))}
              options={[{ value: true, label: R.furnishedYes }, { value: false, label: R.furnishedNo }]} />
          ))}
          <p className="rounded-[var(--radius-control)] bg-surface p-3 text-xs leading-5 text-ink-soft">
            <Users className="me-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
            {fill(R.next, { watchers: property.watchCount })}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button size="lg" loading={action.isPending} onClick={go}>{changed ? R.saveStart : R.noChanges}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteSheet({ open, onClose, view }: { open: boolean; onClose: () => void; view: RenewalView }) {
  const action = useRenewalAction();
  const pushToast = useStore((s) => s.pushToast);
  const C = t.turnover.complete;
  const [end, setEnd] = React.useState(defaultRenewedEnd(view.lease.endDate, view.lease.extensionMonths));
  const [rent, setRent] = React.useState(toShekels(view.lease.monthlyRentAgorot));

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent onOpenAutoFocus={focusSheetOnTouch}>
        <DialogHeader>
          <DialogTitle>{C.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-ink-soft">{C.hint}</p>
          <label className="block space-y-1.5 text-sm font-bold text-ink" htmlFor="renew-end">
            <span>{C.newEnd}</span>
            <Input id="renew-end" type="date" dir="ltr" className="num max-w-48" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label className="block space-y-1.5 text-sm font-bold text-ink" htmlFor="renew-rent">
            <span>{C.rent}</span>
            <Input id="renew-rent" type="number" inputMode="numeric" dir="ltr" className="num max-w-40" value={rent} onChange={(e) => setRent(Number(e.target.value) || 0)} />
          </label>
        </DialogBody>
        <DialogFooter>
          <Button
            size="lg"
            loading={action.isPending}
            onClick={() =>
              action.mutate(
                { leaseId: view.leaseId, action: 'complete', body: { newEndDate: end, monthlyRent: rent } },
                { onSuccess: () => { pushToast(C.done, 'success'); onClose(); } },
              )
            }
          >
            <CalendarCheck2 className="h-4 w-4" />
            {C.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Dashboard ───────────────────────────────────────── */

/** Everything across the portfolio that is the owner's turn — one row, one button each. */
export function NeedsYou({ renewals }: { renewals: RenewalView[] }) {
  const navigate = useNavigate();
  const due = renewals.filter((r) => r.role === 'owner' && r.ownerStep);
  if (due.length === 0) return null;
  return (
    <section className="rounded-[var(--radius-card)] border border-ink p-4" aria-label={O.dashboardTitle}>
      <h2 className="text-base font-extrabold text-ink">{O.dashboardTitle}</h2>
      <p className="mb-3 text-xs text-muted">{O.dashboardHint}</p>
      <ul className="divide-y divide-line">
        {due.map((r) => (
          <li key={r.leaseId}>
            <button
              type="button"
              onClick={() => navigate(`/owner/properties/${r.propertyId}`)}
              className="flex w-full items-center gap-3 py-3 text-start"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{fill(O.steps2[r.ownerStep!], { tenant: r.counterpartName })}</span>
                <span className="block text-xs text-muted">{r.propertyLabel}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 rounded-[var(--radius-control)] bg-ink px-3 py-2 text-sm font-bold text-on-ink">
                {O.go}
                <ArrowLeft className="h-3.5 w-3.5" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

