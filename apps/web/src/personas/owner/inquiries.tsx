import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/data/store';
import {
  t,
  formatAge,
  formatDate,
  type InquiryStatus,
  type OwnerInquiry,
  type OwnerProperty,
} from '@miftan/shared';
import { useInquiries, useInquiryAction, useProperties } from '@/api/hooks';
import { AvailabilityChip } from '@/components/shared/status';
import { Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/components/ui/field';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ArrowLeft, Check, EyeOff, MessageCircleQuestion, Send, UserRound } from 'lucide-react';

const STATUS_TONE: Record<InquiryStatus, 'signal' | 'liveSoft' | 'openSoft' | 'neutral' | 'outline'> = {
  new: 'signal',
  asked_tenant: 'liveSoft',
  answered: 'openSoft',
  replied: 'neutral',
  declined: 'outline',
};

const STEPS: { key: InquiryStatus | 'done'; label: string }[] = [
  { key: 'new', label: t.inquiries.steps.seekerAsked },
  { key: 'asked_tenant', label: t.inquiries.steps.ownerAsks },
  { key: 'answered', label: t.inquiries.steps.tenantAnswers },
  { key: 'replied', label: t.inquiries.steps.ownerReplies },
];

const STEP_INDEX: Record<InquiryStatus, number> = {
  new: 0,
  asked_tenant: 1,
  answered: 2,
  replied: 3,
  declined: 3,
};

export function OwnerInquiries() {
  const {
    data: inquiries = [],
    isLoading,
    isError,
    refetch,
  } = useInquiries();
  const { data: properties = [] } = useProperties();
  const [openId, setOpenId] = React.useState<string | null>(null);

  const owned = React.useMemo(
    () => properties.filter((p): p is OwnerProperty => p.scope === 'owner'),
    [properties],
  );
  const propertyById = React.useMemo(() => new Map(owned.map((p) => [p.id, p])), [owned]);

  const rows = React.useMemo(
    () =>
      (inquiries.filter((x): x is OwnerInquiry => x.scope === 'owner') as OwnerInquiry[])
        .slice()
        .sort(
          (a, b) =>
            STEP_INDEX[a.status] - STEP_INDEX[b.status] || b.createdAt.localeCompare(a.createdAt),
        ),
    [inquiries],
  );

  const waiting = rows.filter((x) => x.status === 'new' || x.status === 'answered').length;
  const open = rows.find((x) => x.id === openId);

  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.inquiries.title}
        subtitle={t.inquiries.subtitle}
        actions={
          waiting ? (
            <Badge tone="signal" size="lg">
              <Num board>{waiting}</Num> {t.inquiries.openCount}
            </Badge>
          ) : null
        }
      />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title={t.inquiries.empty}
          hint={t.inquiries.emptyHint}
        />
      ) : (
        <ul className="stagger space-y-2.5">
          {rows.map((inquiry) => {
            const property = propertyById.get(inquiry.propertyId);
            const step = STEP_INDEX[inquiry.status];
            const actionable = inquiry.status === 'new' || inquiry.status === 'answered';

            return (
              <li key={inquiry.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(inquiry.id)}
                  className={cn(
                    'press-sm w-full rounded-[var(--radius-card)] border p-3.5 text-start',
                    'transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out)]',
                    actionable
                      ? 'border-signal/50 bg-signal-soft/35 hover:border-signal'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink">{inquiry.propertyLabel}</span>
                    <Badge tone={STATUS_TONE[inquiry.status]} size="sm">
                      {t.inquiries.status[inquiry.status]}
                    </Badge>
                    {property ? (
                      <AvailabilityChip
                        kind={property.availability.kind}
                        date={property.availability.date ?? undefined}
                        confidence={property.availability.confidence}
                        size="sm"
                        className="max-sm:hidden"
                      />
                    ) : null}
                    <span className="ms-auto text-2xs text-muted">{formatAge(inquiry.createdAt)}</span>
                  </span>

                  <span className="mt-1.5 flex items-center gap-1.5 text-2xs text-muted">
                    <UserRound className="h-3 w-3" />
                    {inquiry.seeker.name} · {t.inquiries.wants}{' '}
                    <Num board>{formatDate(inquiry.desiredMoveIn)}</Num>
                  </span>

                  <span className="mt-1.5 block line-clamp-2 text-xs leading-5 text-ink-soft">
                    {inquiry.message}
                  </span>

                  <span className="mt-2.5 block">
                    <StepRail step={step} declined={inquiry.status === 'declined'} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <InquiryDrawer inquiry={open} property={open ? propertyById.get(open.propertyId) : undefined} onClose={() => setOpenId(null)} />
    </div>
  );
}

function StepRail({ step, declined }: { step: number; declined?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {STEPS.map((s, i) => {
        const done = i < step || declined;
        const current = i === step && !declined;
        return (
          <React.Fragment key={s.key}>
            {i > 0 ? (
              <span className={cn('h-px flex-1', done ? 'bg-ink' : 'bg-line')} aria-hidden />
            ) : null}
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors duration-200',
                done
                  ? 'bg-ink text-on-ink'
                  : current
                    ? 'bg-signal text-ink'
                    : 'bg-surface-sunk text-muted',
              )}
            >
              {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
              <span className="max-sm:sr-only">{s.label}</span>
            </span>
          </React.Fragment>
        );
      })}
    </span>
  );
}

function InquiryDrawer({
  inquiry,
  property,
  onClose,
}: {
  inquiry?: OwnerInquiry;
  property?: OwnerProperty;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const action = useInquiryAction();
  const pushToast = useStore((s) => s.pushToast);

  const [draft, setDraft] = React.useState('');
  const [availableFrom, setAvailableFrom] = React.useState('');
  const [confidence, setConfidence] = React.useState<'confirmed' | 'likely' | 'unknown'>('likely');

  React.useEffect(() => {
    /* Empty on purpose. The reply is the owner's own words — never a paste
       of what the tenant wrote, even as a "suggestion". */
    setDraft('');
    setAvailableFrom('');
    setConfidence('likely');
  }, [inquiry?.id]);

  if (!inquiry) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[inquiry.status]} size="sm">
              {t.inquiries.status[inquiry.status]}
            </Badge>
            {property ? (
              <AvailabilityChip
                kind={property.availability.kind}
                date={property.availability.date ?? undefined}
                confidence={property.availability.confidence}
                size="sm"
              />
            ) : null}
          </div>
          <DialogTitle className="mt-1.5">{inquiry.propertyLabel}</DialogTitle>
          <p className="mt-0.5 text-xs text-muted">
            {inquiry.seeker.name} · {formatAge(inquiry.createdAt)}
          </p>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <StepRail step={STEP_INDEX[inquiry.status]} declined={inquiry.status === 'declined'} />

          <section className="rounded-[var(--radius-control)] bg-surface p-3">
            <p className="mb-1 text-2xs font-bold text-ink-soft">{t.inquiries.fromSeeker}</p>
            <p className="text-sm leading-6 text-ink">{inquiry.message}</p>
            <p className="mt-1.5 text-2xs text-muted">
              {t.inquiries.wants} <Num board>{formatDate(inquiry.desiredMoveIn)}</Num>
            </p>
          </section>

          {inquiry.tenantAnswer ? (
            <section className="rounded-[var(--radius-control)] border border-line p-3">
              <p className="mb-1 flex items-center justify-between gap-2 text-2xs font-bold text-ink-soft">
                <span>
                  {t.inquiries.reply.tenantSaid}
                  {inquiry.tenant?.name ? ` · ${inquiry.tenant.name}` : ''}
                </span>
                {inquiry.tenantAnsweredAt ? (
                  <span className="font-medium text-muted">{formatAge(inquiry.tenantAnsweredAt)}</span>
                ) : null}
              </p>
              <Badge
                tone={
                  inquiry.tenantAnswer === 'leave'
                    ? 'signalSoft'
                    : inquiry.tenantAnswer === 'extend'
                      ? 'liveSoft'
                      : 'neutral'
                }
                size="md"
              >
                {t.unit.intent[inquiry.tenantAnswer]}
              </Badge>
              {inquiry.tenantAnswerNote ? (
                <p className="mt-2 text-sm leading-6 text-ink-soft">{inquiry.tenantAnswerNote}</p>
              ) : null}
              <p className="mt-2 flex items-start gap-1.5 border-t border-line pt-2 text-2xs leading-4 text-muted">
                <EyeOff className="mt-0.5 h-3 w-3 shrink-0" />
                {t.inquiries.reply.privacyNote}
              </p>
            </section>
          ) : null}

          {inquiry.ownerReply ? (
            <section className="rounded-[var(--radius-control)] bg-ink p-3 text-on-ink">
              <p className="mb-1 text-2xs font-bold text-on-ink-muted">{t.inquiries.seeker.ownerReply}</p>
              <p className="text-sm leading-6">{inquiry.ownerReply}</p>
            </section>
          ) : inquiry.status === 'answered' ? (
            <section className="space-y-3">
              <p className="text-2xs font-bold text-ink-soft">{t.inquiries.reply.title}</p>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.inquiries.reply.placeholder}
                className="min-h-28"
                aria-label={t.inquiries.reply.title}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t.inquiries.reply.publishDate} htmlFor="publish-date">
                  <Input
                    id="publish-date"
                    type="date"
                    dir="ltr"
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                  />
                </Field>
                <Field label={t.inquiries.reply.dateConfidence}>
                  <Select
                    value={confidence}
                    onValueChange={(v) => setConfidence(v as 'confirmed' | 'likely' | 'unknown')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">{t.availability.confirmed}</SelectItem>
                      <SelectItem value="likely">{t.availability.likely}</SelectItem>
                      <SelectItem value="unknown">{t.availability.unknown}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>
          ) : null}
        </DialogBody>

        <DialogFooter className="flex-wrap">
          {inquiry.status === 'new' ? (
            <>
              <Button
                loading={action.isPending}
                onClick={() =>
                  action.mutate(
                    { id: inquiry.id, action: 'ask-tenant' },
                    {
                      onSuccess: () => {
                        pushToast(t.inquiries.askTenant.sent, 'success');
                        onClose();
                      },
                    },
                  )
                }
              >
                <Send className="h-4 w-4" />
                {t.inquiries.actions.askTenant}
              </Button>
              <Button
                variant="secondary"
                loading={action.isPending}
                onClick={() =>
                  action.mutate(
                    { id: inquiry.id, action: 'decline' },
                    { onSuccess: onClose },
                  )
                }
              >
                {t.inquiries.actions.decline}
              </Button>
            </>
          ) : null}

          {inquiry.status === 'answered' ? (
            <Button
              loading={action.isPending}
              disabled={!draft.trim()}
              onClick={() =>
                action.mutate(
                  {
                    id: inquiry.id,
                    action: 'reply',
                    body: {
                      reply: draft.trim(),
                      availableFrom: availableFrom || undefined,
                      confidence,
                    },
                  },
                  {
                    onSuccess: () => {
                      pushToast(t.inquiries.reply.sent, 'success');
                      onClose();
                    },
                  },
                )
              }
            >
              <Send className="h-4 w-4" />
              {t.inquiries.reply.send}
            </Button>
          ) : null}

          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              navigate(`/owner/properties/${inquiry.propertyId}`);
            }}
          >
            {t.inquiries.actions.viewUnit}
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>

          <DialogClose asChild>
            <Button variant="ghost">{t.shell.close}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
