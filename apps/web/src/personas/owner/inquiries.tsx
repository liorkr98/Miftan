import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t, formatAge, formatDate, type AvailabilityInquiry, type InquiryStatus } from '@miftach/shared';
import { availabilityKind, leaseForProperty } from '@/data/selectors';
import { AvailabilityChip } from '@/components/shared/status';
import { Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { useDelayedReady } from '@/lib/use-delayed-ready';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/field';
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

/** The four-step chain, drawn so the owner can see where a request is stuck. */
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
  const ready = useDelayedReady();
  const { inquiries, properties, seekers, leases } = useStoreShallow((s) => ({
    inquiries: s.inquiries,
    properties: s.properties,
    seekers: s.seekers,
    leases: s.leases,
  }));

  const [openId, setOpenId] = React.useState<string | null>(null);

  const rows = React.useMemo(
    () => [...inquiries].sort((a, b) => STEP_INDEX[a.status] - STEP_INDEX[b.status] || b.created_at.localeCompare(a.created_at)),
    [inquiries],
  );

  const waiting = inquiries.filter((x) => x.status === 'new' || x.status === 'answered').length;
  const open = inquiries.find((x) => x.id === openId);

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

      {!ready ? (
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
            const property = properties.find((p) => p.id === inquiry.property_id);
            const seeker = seekers.find((x) => x.id === inquiry.seeker_id);
            const lease = property ? leaseForProperty(leases, property.id) : undefined;
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
                    <span className="text-sm font-bold text-ink">
                      {property ? `${property.address.street} ${property.address.number}` : ''}
                    </span>
                    <span className="text-2xs text-muted">{property?.address.neighborhood}</span>
                    <Badge tone={STATUS_TONE[inquiry.status]} size="sm">
                      {t.inquiries.status[inquiry.status]}
                    </Badge>
                    {property ? (
                      <AvailabilityChip
                        kind={availabilityKind(property, lease)}
                        date={property.available_from}
              confidence={property.availability_confidence}
                        size="sm"
                        className="max-sm:hidden"
                      />
                    ) : null}
                    <span className="ms-auto text-2xs text-muted">{formatAge(inquiry.created_at)}</span>
                  </span>

                  <span className="mt-1.5 flex items-center gap-1.5 text-2xs text-muted">
                    <UserRound className="h-3 w-3" />
                    {seeker?.name} · {t.inquiries.wants}{' '}
                    <Num board>{formatDate(inquiry.desired_move_in)}</Num>
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

      <InquiryDrawer inquiry={open} onClose={() => setOpenId(null)} />
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

/* ── Detail: ask the tenant, then update the seeker ────── */

function InquiryDrawer({
  inquiry,
  onClose,
}: {
  inquiry?: AvailabilityInquiry;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { properties, seekers, leases, tenants } = useStoreShallow((s) => ({
    properties: s.properties,
    seekers: s.seekers,
    leases: s.leases,
    tenants: s.tenants,
  }));
  const askTenant = useStore((s) => s.askTenantAboutRenewal);
  const replyToInquiry = useStore((s) => s.replyToInquiry);
  const declineInquiry = useStore((s) => s.declineInquiry);
  const pushToast = useStore((s) => s.pushToast);

  const [draft, setDraft] = React.useState('');

  const property = properties.find((p) => p.id === inquiry?.property_id);
  const lease = property ? leaseForProperty(leases, property.id) : undefined;
  const seeker = seekers.find((x) => x.id === inquiry?.seeker_id);
  const tenant = lease ? tenants.find((x) => x.id === lease.tenant_id) : undefined;

  /* A suggested reply written from the tenant's answer, so the owner is
     editing a sentence rather than composing one. */
  const suggested = React.useMemo(() => {
    if (!inquiry?.tenant_answer) return '';
    const when = lease ? formatDate(lease.end_date) : '';
    const draft = t.inquiries.reply.draft;
    const template =
      inquiry.tenant_answer === 'leave'
        ? draft.leave
        : inquiry.tenant_answer === 'extend'
          ? draft.extend
          : inquiry.tenant_answer === 'too_early'
            ? draft.too_early
            : draft.undecided;
    return template.replace('{date}', when);
  }, [inquiry?.tenant_answer, lease]);

  React.useEffect(() => {
    setDraft(suggested);
  }, [suggested, inquiry?.id]);

  if (!inquiry || !property) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[inquiry.status]} size="sm">
              {t.inquiries.status[inquiry.status]}
            </Badge>
            <AvailabilityChip
              kind={availabilityKind(property, lease)}
              date={property.available_from}
              confidence={property.availability_confidence}
              size="sm"
            />
          </div>
          <DialogTitle className="mt-1.5">
            {property.address.street} {property.address.number}
          </DialogTitle>
          <p className="mt-0.5 text-xs text-muted">
            {property.address.neighborhood} · {seeker?.name} · {formatAge(inquiry.created_at)}
          </p>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <StepRail step={STEP_INDEX[inquiry.status]} declined={inquiry.status === 'declined'} />

          {/* The seeker's question */}
          <section className="rounded-[var(--radius-control)] bg-surface p-3">
            <p className="mb-1 text-2xs font-bold text-ink-soft">{t.inquiries.fromSeeker}</p>
            <p className="text-sm leading-6 text-ink">{inquiry.message}</p>
            <p className="mt-1.5 text-2xs text-muted">
              {t.inquiries.wants} <Num board>{formatDate(inquiry.desired_move_in)}</Num>
            </p>
          </section>

          {/* What the tenant said, if anything */}
          {inquiry.tenant_answer ? (
            <section className="rounded-[var(--radius-control)] border border-line p-3">
              <p className="mb-1 flex items-center justify-between gap-2 text-2xs font-bold text-ink-soft">
                <span>
                  {t.inquiries.reply.tenantSaid} · {tenant?.name}
                </span>
                {inquiry.tenant_answered_at ? (
                  <span className="font-medium text-muted">{formatAge(inquiry.tenant_answered_at)}</span>
                ) : null}
              </p>
              <Badge
                tone={
                  inquiry.tenant_answer === 'leave'
                    ? 'signalSoft'
                    : inquiry.tenant_answer === 'extend'
                      ? 'liveSoft'
                      : 'neutral'
                }
                size="md"
              >
                {t.unit.intent[inquiry.tenant_answer]}
              </Badge>
              {inquiry.tenant_answer_note ? (
                <p className="mt-2 text-sm leading-6 text-ink-soft">{inquiry.tenant_answer_note}</p>
              ) : null}
              <p className="mt-2 flex items-start gap-1.5 border-t border-line pt-2 text-2xs leading-4 text-muted">
                <EyeOff className="mt-0.5 h-3 w-3 shrink-0" />
                {t.inquiries.reply.privacyNote}
              </p>
            </section>
          ) : null}

          {/* The owner's reply, once sent */}
          {inquiry.owner_reply ? (
            <section className="rounded-[var(--radius-control)] bg-ink p-3 text-on-ink">
              <p className="mb-1 text-2xs font-bold text-on-ink-muted">
                {t.inquiries.seeker.ownerReply}
              </p>
              <p className="text-sm leading-6">{inquiry.owner_reply}</p>
            </section>
          ) : inquiry.status === 'answered' ? (
            <section>
              <p className="mb-1.5 text-2xs font-bold text-ink-soft">{t.inquiries.reply.suggested}</p>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.inquiries.reply.placeholder}
                className="min-h-28"
                aria-label={t.inquiries.reply.title}
              />
            </section>
          ) : null}
        </DialogBody>

        <DialogFooter className="flex-wrap">
          {inquiry.status === 'new' ? (
            <>
              <Button
                onClick={() => {
                  askTenant(inquiry.id);
                  pushToast(t.inquiries.askTenant.sent, 'success');
                }}
              >
                <Send className="h-4 w-4" />
                {t.inquiries.actions.askTenant}
              </Button>
              <Button variant="secondary" onClick={() => declineInquiry(inquiry.id)}>
                {t.inquiries.actions.decline}
              </Button>
            </>
          ) : null}

          {inquiry.status === 'asked_tenant' ? (
            <Button
              variant="secondary"
              onClick={() => pushToast(t.inquiries.actions.askTenantAgain, 'success')}
            >
              {t.inquiries.actions.askTenantAgain}
            </Button>
          ) : null}

          {inquiry.status === 'answered' ? (
            <Button
              disabled={!draft.trim()}
              onClick={() => {
                replyToInquiry(inquiry.id, draft.trim());
                pushToast(t.inquiries.reply.sent, 'success');
              }}
            >
              <Send className="h-4 w-4" />
              {t.inquiries.reply.send}
            </Button>
          ) : null}

          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              navigate(`/owner/properties/${property.id}`);
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
