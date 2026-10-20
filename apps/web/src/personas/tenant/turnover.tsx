import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatDateTime, RENEWAL_TOPICS, t, type RenewalTopic, type RenewalView } from '@miftan/shared';
import { useMeetingSlotAction, useRenewalAction } from '@/api/hooks';
import { useStore } from '@/data/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Num } from '@/components/shared/typography';
import { SlotGrid } from '@/components/shared/scheduling';
import { cn } from '@/lib/utils';
import { ArrowLeft, CalendarCheck2, Check, CheckCircle2, Clock3, HelpCircle, LogOut, MessageCircleQuestion, PartyPopper } from 'lucide-react';

/**
 * The tenant's side of a lease ending. One card, whose content is whatever
 * the tenant can do right now — and when there is nothing to do, it says what
 * happens next and who is doing it.
 */

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

const T = t.turnover.tenant;

export function TenantTurnover({ view }: { view: RenewalView }) {
  const owner = view.counterpartName || t.tenant.landlord;
  const [early, setEarly] = React.useState(false);

  if (view.stage === 'upcoming' && !early) {
    return (
      <Card>
        <CalendarCheck2 className="h-6 w-6 text-muted" aria-hidden />
        <h2 className="text-lg font-extrabold text-ink">{fill(T.upcomingTitle, { date: formatDate(view.lease.endDate) })}</h2>
        <p className="text-sm leading-6 text-ink-soft">{fill(T.upcomingBody, { opens: formatDate(view.opensOn) })}</p>
        <Button variant="secondary" size="lg" className="self-start" onClick={() => setEarly(true)}>
          {T.answerNow}
        </Button>
      </Card>
    );
  }

  if (view.stage === 'upcoming' || view.tenantStep === 'decide' || view.stage === 'questions') {
    return <Decide view={view} owner={owner} />;
  }

  if (view.stage === 'staying') return <Staying view={view} owner={owner} />;
  if (view.stage === 'leaving' || view.stage === 'closed') return <Leaving view={view} owner={owner} />;

  if (view.stage === 'renewed') {
    return (
      <Card>
        <PartyPopper className="h-6 w-6 text-open" aria-hidden />
        <h2 className="text-lg font-extrabold text-ink">{T.renewedTitle}</h2>
        <p className="text-sm text-ink-soft">{fill(T.renewedBody, { date: formatDate(view.newEndDate ?? view.lease.endDate) })}</p>
      </Card>
    );
  }
  return null;
}

function Card({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'act' }) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-[var(--radius-card)] border p-5 motion-safe:animate-[fade-up_240ms_var(--ease-out)_both]',
        tone === 'act' ? 'border-ink bg-bg shadow-[0_1px_0_rgba(0,0,0,0.03)]' : 'border-line bg-bg',
      )}
    >
      {children}
    </section>
  );
}

function Decide({ view, owner }: { view: RenewalView; owner: string }) {
  const action = useRenewalAction();
  const pushToast = useStore((s) => s.pushToast);
  const [confirm, setConfirm] = React.useState<'stay' | 'leave' | null>(null);
  const [asking, setAsking] = React.useState(false);

  const decide = (decision: 'stay' | 'leave') =>
    action.mutate(
      { leaseId: view.leaseId, action: 'decision', body: { decision } },
      {
        onSuccess: () => {
          setConfirm(null);
          pushToast(T.decided, 'success');
        },
      },
    );

  if (view.stage === 'questions') {
    return (
      <Card>
        <Clock3 className="h-6 w-6 text-muted" aria-hidden />
        <h2 className="text-lg font-extrabold text-ink">{T.yourQuestions}</h2>
        <QuestionList view={view} />
        <p className="rounded-[var(--radius-control)] bg-surface p-3 text-sm leading-6 text-ink-soft">{fill(T.waitingAnswers, { owner })}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" onClick={() => setConfirm('stay')}>{T.stay}</Button>
          <Button variant="secondary" onClick={() => setConfirm('leave')}>{T.leave}</Button>
        </div>
        <ConfirmSheet view={view} owner={owner} which={confirm} onClose={() => setConfirm(null)} onConfirm={decide} pending={action.isPending} />
      </Card>
    );
  }

  return (
    <Card tone="act">
      {view.stage === 'answered' ? (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-ink">{fill(T.answersTitle, { owner })}</h3>
          <Answers view={view} />
        </div>
      ) : null}

      <h2 className="text-xl font-extrabold leading-8 text-ink">{T.question}</h2>
      <p className="text-sm text-ink-soft">
        {fill(T.ends, { date: formatDate(view.lease.endDate) })} ·{' '}
        <span className="font-semibold text-ink">
          {view.stage === 'answered'
            ? fill(T.decideBy, { date: formatDateTime(view.answerBy) })
            : fill(T.answerBy, { date: formatDate(view.answerBy) })}
        </span>
      </p>
      {view.overdue ? (
        <p role="status" className="rounded-[var(--radius-control)] border border-alert/40 bg-alert-soft p-3 text-sm leading-6 text-ink">
          {T.overdueNote}
        </p>
      ) : null}

      <div className="grid gap-2 pt-1">
        <Choice Icon={CheckCircle2} title={T.stay} hint={T.stayHint} onClick={() => setConfirm('stay')} />
        <Choice Icon={LogOut} title={T.leave} hint={T.leaveHint} onClick={() => setConfirm('leave')} />
        {view.stage !== 'answered' ? (
          <Choice Icon={HelpCircle} title={T.ask} hint={T.askHint} onClick={() => setAsking((v) => !v)} pressed={asking} />
        ) : (
          <button type="button" onClick={() => setAsking((v) => !v)} className="self-start text-sm font-semibold text-ink underline underline-offset-4">
            {T.askMore}
          </button>
        )}
      </div>

      {asking ? <AskQuestions view={view} onSent={() => setAsking(false)} /> : null}
      <ConfirmSheet view={view} owner={owner} which={confirm} onClose={() => setConfirm(null)} onConfirm={decide} pending={action.isPending} />
    </Card>
  );
}

function Choice({
  Icon,
  title,
  hint,
  onClick,
  pressed,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        'press flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-start transition-colors duration-150',
        pressed ? 'border-ink bg-surface' : 'border-line-strong hover:border-ink hover:bg-surface',
      )}
    >
      <Icon className="h-6 w-6 shrink-0 text-ink" />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-ink">{title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <ArrowLeft className="h-4 w-4 shrink-0 text-muted" aria-hidden />
    </button>
  );
}

function ConfirmSheet({
  view,
  owner,
  which,
  onClose,
  onConfirm,
  pending,
}: {
  view: RenewalView;
  owner: string;
  which: 'stay' | 'leave' | null;
  onClose: () => void;
  onConfirm: (d: 'stay' | 'leave') => void;
  pending: boolean;
}) {
  const moveOut = formatDate(view.lease.endDate);
  return (
    <Dialog open={which !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{which === 'leave' ? T.confirmLeaveTitle : T.confirmStayTitle}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-base leading-7 text-ink-soft">
            {which === 'leave' ? fill(T.confirmLeaveBody, { owner, date: moveOut }) : fill(T.confirmStayBody, { owner })}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button size="lg" loading={pending} onClick={() => which && onConfirm(which)}>
            {which === 'leave' ? T.confirmLeave : T.confirmStay}
          </Button>
          <DialogClose asChild>
            <Button variant="secondary" size="lg">{t.ui.cancel}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AskQuestions({ view, onSent }: { view: RenewalView; onSent: () => void }) {
  const action = useRenewalAction();
  const pushToast = useStore((s) => s.pushToast);
  const [topics, setTopics] = React.useState<RenewalTopic[]>([]);
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState(false);

  const send = () => {
    if (topics.length === 0 && !text.trim()) return setError(true);
    action.mutate(
      { leaseId: view.leaseId, action: 'questions', body: { topics, text: text.trim() || null } },
      { onSuccess: () => { pushToast(T.sent, 'success'); onSent(); } },
    );
  };

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] bg-surface p-4">
      <div>
        <h3 className="text-base font-bold text-ink">{T.askTitle}</h3>
        <p className="text-xs text-muted">{T.askHint2}</p>
      </div>
      <div className="grid gap-2" role="group" aria-label={T.askTitle}>
        {RENEWAL_TOPICS.map((topic) => {
          const on = topics.includes(topic);
          return (
            <button
              key={topic}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setError(false);
                setTopics((list) => (on ? list.filter((x) => x !== topic) : [...list, topic]));
              }}
              className={cn(
                'press-sm flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] border px-3 text-start text-sm font-semibold',
                on ? 'border-ink bg-bg text-ink' : 'border-line bg-bg text-ink-soft hover:border-line-strong',
              )}
            >
              <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border', on ? 'border-ink bg-ink text-on-ink' : 'border-line-strong')}>
                {on ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              {t.turnover.topics[topic]}
            </button>
          );
        })}
      </div>
      <label className="block text-xs font-bold text-ink-soft" htmlFor="renewal-other">
        {T.otherLabel}
      </label>
      <Textarea
        id="renewal-other"
        value={text}
        onChange={(e) => {
          setError(false);
          setText(e.target.value);
        }}
        placeholder={T.otherPlaceholder}
        className="min-h-20 bg-bg"
      />
      {error ? <p role="alert" className="text-xs font-semibold text-alert">{T.pickOne}</p> : null}
      <Button size="lg" className="w-full sm:w-auto" loading={action.isPending} onClick={send}>
        <MessageCircleQuestion className="h-4 w-4" />
        {T.send}
      </Button>
    </div>
  );
}

function QuestionList({ view }: { view: RenewalView }) {
  return (
    <ul className="space-y-1.5">
      {view.questions.map((q, i) => (
        <li key={i} className="rounded-[var(--radius-control)] border border-line px-3 py-2 text-sm text-ink">
          {q.topic === 'other' ? q.text : t.turnover.topics[q.topic]}
        </li>
      ))}
    </ul>
  );
}

/** The owner's answers, each under the question it answers. */
function Answers({ view }: { view: RenewalView }) {
  const asked = new Map(view.questions.map((q) => [q.topic, q]));
  return (
    <ul className="space-y-2">
      {view.answers.map((a, i) => {
        const q = asked.get(a.topic);
        return (
          <li key={i} className="rounded-[var(--radius-control)] bg-surface p-3">
            <p className="text-xs text-muted">{a.topic === 'other' ? (q?.text ?? t.turnover.topics.other) : t.turnover.topics[a.topic]}</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{a.answer}</p>
          </li>
        );
      })}
    </ul>
  );
}

function Staying({ view, owner }: { view: RenewalView; owner: string }) {
  const slotAction = useMeetingSlotAction();
  const action = useRenewalAction();
  const pushToast = useStore((s) => s.pushToast);
  const [rescheduling, setRescheduling] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  const book = (id: string) =>
    slotAction.mutate(
      { id, action: 'book' },
      {
        onSuccess: () => {
          setRescheduling(false);
          pushToast(T.meetingSet, 'success');
        },
        onError: () => pushToast(t.turnover.slots.gone, 'alert'),
      },
    );

  const open = view.meetingSlots.filter((x) => x.status === 'open' && new Date(x.startsAt) > new Date());

  return (
    <Card tone={view.tenantStep ? 'act' : 'plain'}>
      {view.meeting && !rescheduling ? (
        <>
          <CalendarCheck2 className="h-6 w-6 text-open" aria-hidden />
          <h2 className="text-lg font-extrabold text-ink">{T.meetingSet}</h2>
          <p className="text-xl font-bold text-ink"><Num board>{formatDateTime(view.meeting.startsAt)}</Num></p>
          <p className="text-sm text-ink-soft">{fill(T.meetingWith, { owner })}</p>
          {open.length > 0 ? (
            <Button variant="secondary" className="self-start" onClick={() => setRescheduling(true)}>{T.changeTime}</Button>
          ) : null}
        </>
      ) : view.tenantStep === 'pick_meeting_time' || rescheduling ? (
        <>
          <h2 className="text-lg font-extrabold text-ink">{T.pickTimeTitle}</h2>
          <p className="text-sm text-ink-soft">{fill(T.pickTimeHint, { owner })}</p>
          <SlotGrid
            slots={view.meetingSlots
              .filter((x) => new Date(x.startsAt) > new Date())
              .map((x) => ({ id: x.id, startsAt: x.startsAt, state: x.status === 'booked' ? 'mine' : 'open' }))}
            onPick={book}
            pendingId={slotAction.isPending ? (slotAction.variables?.id ?? null) : null}
          />
        </>
      ) : (
        <>
          <Clock3 className="h-6 w-6 text-muted" aria-hidden />
          <h2 className="text-lg font-extrabold text-ink">{T.confirmStayTitle}</h2>
          <p className="text-sm leading-6 text-ink-soft">{fill(T.stayingWaitTimes, { owner })}</p>
        </>
      )}

      {view.canChangeDecision ? (
        <button type="button" onClick={() => setLeaving(true)} className="self-start pt-1 text-xs font-semibold text-muted underline underline-offset-4 hover:text-ink">
          {T.leaveAfterAll}
        </button>
      ) : null}
      <ConfirmSheet
        view={view}
        owner={owner}
        which={leaving ? 'leave' : null}
        onClose={() => setLeaving(false)}
        onConfirm={(d) => action.mutate({ leaseId: view.leaseId, action: 'decision', body: { decision: d } }, { onSuccess: () => setLeaving(false) })}
        pending={action.isPending}
      />
    </Card>
  );
}

function Leaving({ view, owner }: { view: RenewalView; owner: string }) {
  const action = useRenewalAction();
  const [staying, setStaying] = React.useState(false);
  return (
    <Card>
      <CheckCircle2 className="h-6 w-6 text-ink" aria-hidden />
      <h2 className="text-lg font-extrabold text-ink">{T.leavingTitle}</h2>
      <p className="text-sm leading-6 text-ink-soft">{fill(T.leavingBody, { date: formatDate(view.moveOutDate ?? view.lease.endDate) })}</p>
      {view.canChangeDecision ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-sm text-muted">{T.changeMind}</span>
          <Button variant="secondary" onClick={() => setStaying(true)}>{T.stayAfterAll}</Button>
        </div>
      ) : view.stage === 'leaving' ? (
        <p className="border-t border-line pt-3 text-xs leading-5 text-muted">{T.lockedChange}</p>
      ) : null}
      <ConfirmSheet
        view={view}
        owner={owner}
        which={staying ? 'stay' : null}
        onClose={() => setStaying(false)}
        onConfirm={(d) => action.mutate({ leaseId: view.leaseId, action: 'decision', body: { decision: d } }, { onSuccess: () => setStaying(false) })}
        pending={action.isPending}
      />
    </Card>
  );
}

/** On the tenant's home: one line and one button, only when something needs them. */
export function TenantTurnoverNudge({ view }: { view: RenewalView }) {
  const navigate = useNavigate();
  if (!view.tenantStep) return null;
  const pick = view.tenantStep === 'pick_meeting_time';
  return (
    <button
      type="button"
      onClick={() => navigate('/tenant/renewal')}
      className="press flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-ink bg-bg p-4 text-start"
    >
      {pick ? <CalendarCheck2 className="h-6 w-6 shrink-0 text-ink" /> : <HelpCircle className="h-6 w-6 shrink-0 text-ink" />}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-ink">{pick ? T.pickTimeTitle : T.question}</span>
        <span className="block text-xs text-muted">
          {pick ? null : fill(T.answerBy, { date: formatDate(view.answerBy) })}
        </span>
      </span>
      <span className="shrink-0 rounded-[var(--radius-control)] bg-ink px-3 py-2 text-sm font-bold text-on-ink">
        {pick ? T.homeCtaTime : T.homeCta}
      </span>
    </button>
  );
}
