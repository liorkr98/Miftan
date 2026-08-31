import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  formatAgorot,
  formatAge,
  formatDateTime,
  formatTime,
  formatWeekdayDate,
  t,
  toAgorot,
  type TicketStatus,
  type TicketView,
  type VendorView,
} from '@miftan/shared';
import {
  useConfirmSlot,
  usePostMessage,
  useTicketAction,
  useTickets,
  useUploadReceipt,
  useVendors,
} from '@/api/hooks';
import { useStore } from '@/data/store';
import { Num, PageHeader, Phone } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { SeverityBadge, TicketStatusBadge } from '@/components/shared/status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { ListSkeleton } from '@/components/shared/skeleton';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  ClipboardCheck,
  Image as ImageIcon,
  Receipt,
  Send,
  ServerCrash,
  Star,
  UserCheck,
  Wrench,
} from 'lucide-react';

/* Columns flow right-to-left: "new" sits at the start (right) edge. */
const COLUMNS: TicketStatus[] = [
  'new',
  'approved',
  'assigned',
  'in_progress',
  'awaiting_receipt',
  'closed',
];

/**
 * Which button each action gets. The *availability* of an action is decided by
 * the server and arrives on the ticket — this map only says how to draw one, so
 * the two copies of the rules that used to exist are now one.
 */
const ACTION_UI: Record<
  string,
  { label: string; icon?: React.ComponentType<{ className?: string }>; variant?: 'primary' | 'secondary' }
> = {
  approve: { label: t.tickets.actions.approve, icon: ClipboardCheck },
  reject: { label: t.tickets.actions.reject, variant: 'secondary' },
  assign: { label: t.tickets.actions.assignVendor, icon: UserCheck },
  start: { label: t.tickets.actions.markInProgress, icon: Wrench },
  request_receipt: { label: t.tickets.actions.requestReceipt, icon: Receipt },
  close: { label: t.tickets.actions.close, variant: 'secondary' },
  reopen: { label: t.tickets.actions.reopen, variant: 'secondary' },
};

export function OwnerTickets() {
  const [params, setParams] = useSearchParams();
  const { data: tickets = [], isLoading, isError, refetch } = useTickets();

  const openId = params.get('ticket');
  const openTicket = tickets.find((tk) => tk.id === openId);

  const open = tickets.filter((tk) => tk.status !== 'closed');
  const urgent = open.filter((tk) => tk.severity === 'urgent');

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('ticket', id);
    else next.delete('ticket');
    setParams(next, { replace: true });
  };

  if (isError) {
    return (
      <EmptyState
        icon={ServerCrash}
        title={t.auth.error.internal}
        action={t.ui.reset}
        onAction={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.tickets.title}
        subtitle={t.tickets.subtitle}
        actions={
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted">
              <Num board className="font-bold text-ink">
                {open.length}
              </Num>{' '}
              {t.tickets.open}
            </span>
            {urgent.length > 0 ? (
              <span className="flex items-center gap-1.5">
                <SeverityBadge severity="urgent" size="sm" />
                <Num board className="font-bold text-ink">
                  {urgent.length}
                </Num>
              </span>
            ) : null}
          </div>
        }
      />

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="hide-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {COLUMNS.map((status) => {
            const column = tickets
              .filter((tk) => tk.status === status)
              .sort(
                (a, b) =>
                  (b.severity === 'urgent' ? 1 : 0) - (a.severity === 'urgent' ? 1 : 0) ||
                  a.createdAt.localeCompare(b.createdAt),
              );
            return (
              <section
                key={status}
                className="flex w-[17rem] shrink-0 flex-col rounded-[var(--radius-card)] border border-line bg-surface"
              >
                <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <h2 className="text-xs font-bold text-ink">{t.ticketStatus[status]}</h2>
                  <Num board className="text-2xs font-bold text-muted">
                    {column.length}
                  </Num>
                </header>
                <div className="flex flex-1 flex-col gap-2 p-2 pt-0">
                  {column.length === 0 ? (
                    <p className="rounded-[var(--radius-control)] border border-dashed border-line py-6 text-center text-2xs text-muted">
                      {t.tickets.emptyColumn}
                    </p>
                  ) : (
                    column.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setOpen(ticket.id)}
                        className={cn(
                          'press-sm w-full rounded-[var(--radius-control)] border bg-bg p-2.5 text-start',
                          'transition-[border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-line-strong',
                          ticket.severity === 'urgent' ? 'border-alert/40' : 'border-line',
                        )}
                      >
                        <span className="mb-1.5 flex items-center gap-1.5">
                          <SeverityBadge severity={ticket.severity} size="sm" />
                          <Badge tone="outline" size="sm">
                            {t.ticketCategory[ticket.category]}
                          </Badge>
                        </span>
                        <span className="block text-xs font-bold leading-5 text-ink">
                          {ticket.title}
                        </span>
                        <span className="mt-1 block truncate text-2xs text-muted">
                          {ticket.propertyLabel}
                        </span>
                        <span className="mt-2 flex items-center gap-2 text-2xs text-muted">
                          {ticket.photos.length ? (
                            <span className="flex items-center gap-0.5">
                              <ImageIcon className="h-3 w-3" />
                              <Num board>{ticket.photos.length}</Num>
                            </span>
                          ) : null}
                          <span>{formatAge(ticket.createdAt)}</span>
                          {ticket.vendor ? (
                            <span className="ms-auto truncate font-semibold text-ink-soft">
                              {ticket.vendor.name.split(' ')[0]}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {openTicket ? <TicketDrawer ticket={openTicket} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

/* ── Detail ────────────────────────────────────────────── */

function TicketDrawer({ ticket, onClose }: { ticket: TicketView; onClose: () => void }) {
  const action = useTicketAction();
  const postMessage = usePostMessage();
  const pushToast = useStore((s) => s.pushToast);

  const [draft, setDraft] = React.useState('');
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [receiptOpen, setReceiptOpen] = React.useState(false);

  const owner = ticket.scope === 'owner' ? ticket : null;
  const busy = action.isPending || postMessage.isPending;

  const run = (name: string) => {
    if (name === 'assign') return setAssignOpen(true);
    action.mutate(
      { id: ticket.id, action: name },
      { onError: () => pushToast(t.auth.error.forbidden, 'alert') },
    );
  };

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent wide className="sm:max-h-[88dvh]">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <SeverityBadge severity={ticket.severity} size="sm" />
              <TicketStatusBadge status={ticket.status} size="sm" />
              <Badge tone="outline" size="sm">
                {t.ticketCategory[ticket.category]}
              </Badge>
            </div>
            <DialogTitle className="mt-1.5">{ticket.title}</DialogTitle>
            <p className="mt-0.5 text-xs text-muted">
              {ticket.propertyLabel}
              {owner?.reportedBy ? ` · ${owner.reportedBy.name}` : ''} ·{' '}
              {formatAge(ticket.createdAt)}
            </p>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-control)] bg-surface p-3">
                <p className="mb-1 text-2xs font-bold text-ink-soft">{t.tickets.detail.details}</p>
                {ticket.vendor ? (
                  <>
                    <p className="text-sm font-bold text-ink">{ticket.vendor.name}</p>
                    <p className="text-2xs text-muted">
                      {t.trade[ticket.vendor.trade as keyof typeof t.trade]}
                    </p>
                    <Phone value={ticket.vendor.phone} className="mt-1 block text-2xs text-muted" />
                    {ticket.scheduledAt ? (
                      <p className="mt-1.5 text-2xs text-ink-soft">
                        {t.tickets.scheduled}:{' '}
                        <Num board className="font-bold">
                          {formatDateTime(ticket.scheduledAt)}
                        </Num>
                      </p>
                    ) : null}
                    {ticket.tenantConfirmedSlot ? (
                      <Badge tone="openSoft" size="sm" className="mt-1.5">
                        <CheckCircle2 className="h-3 w-3" />
                        {t.tenant.tickets.slotConfirmed}
                      </Badge>
                    ) : null}
                    {owner?.vendorCalloutFeeAgorot != null ? (
                      <p className="mt-1.5 text-2xs text-muted">
                        {t.vendors.calloutFee}:{' '}
                        <Num board>{formatAgorot(owner.vendorCalloutFeeAgorot)}</Num>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs text-muted">{t.tickets.noVendor}</p>
                )}
              </div>

              <div className="rounded-[var(--radius-control)] bg-surface p-3">
                <p className="mb-1 text-2xs font-bold text-ink-soft">{t.tickets.detail.receipt}</p>
                {ticket.receipt ? (
                  <div className="flex items-start gap-2.5">
                    {ticket.receipt.file ? (
                      <img
                        src={ticket.receipt.file}
                        alt=""
                        loading="lazy"
                        className="h-16 w-12 shrink-0 rounded-[4px] border border-line object-cover"
                      />
                    ) : null}
                    <div>
                      <Num board className="text-base font-bold text-ink">
                        {formatAgorot(ticket.receipt.amountAgorot)}
                      </Num>
                      <p className="text-2xs text-muted">
                        {t.tickets.detail.uploadedBy}{' '}
                        {ticket.receipt.uploadedBy === 'tenant' ? t.roles.tenant : t.roles.owner}
                      </p>
                      {owner?.expenseId ? (
                        <Badge tone="openSoft" size="sm" className="mt-1">
                          {t.tickets.detail.expenseCreated}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted">{t.tickets.detail.noReceipt}</p>
                )}
              </div>
            </div>

            {ticket.tenantAvailability.length > 0 && !ticket.scheduledAt ? (
              <div>
                <p className="mb-1.5 text-2xs font-bold text-ink-soft">
                  {t.tickets.detail.tenantAvailability}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.tenantAvailability.map((slot) => (
                    <Badge key={slot} tone="outline" size="sm">
                      <Num board>
                        {formatWeekdayDate(slot)} · {formatTime(slot)}
                      </Num>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-2xs font-bold text-ink-soft">{t.tickets.detail.conversation}</p>
              <ul className="space-y-2.5">
                {ticket.messages.map((message) => (
                  <li
                    key={message.id}
                    className={cn(
                      'rounded-[var(--radius-control)] border p-2.5',
                      message.authorRole === 'owner'
                        ? 'border-ink/15 bg-surface'
                        : message.authorRole === 'vendor'
                          ? 'border-live/25 bg-live-soft'
                          : 'border-line bg-bg',
                    )}
                  >
                    <p className="mb-1 flex items-baseline justify-between gap-2 text-2xs">
                      <span className="font-bold text-ink">{message.authorName}</span>
                      <span className="text-muted">{formatAge(message.at)}</span>
                    </p>
                    <p className="text-sm leading-6 text-ink-soft">{message.body}</p>
                    {message.photos.length ? (
                      <div className="mt-2 flex gap-1.5">
                        {message.photos.map((src) => (
                          <img
                            key={src}
                            src={src}
                            alt=""
                            loading="lazy"
                            className="h-16 w-16 rounded-[6px] border border-line object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t.tickets.detail.writeMessage}
                  className="min-h-16"
                  aria-label={t.tickets.detail.writeMessage}
                />
                <Button
                  size="icon"
                  disabled={!draft.trim() || busy}
                  aria-label={t.tickets.detail.send}
                  onClick={() =>
                    postMessage.mutate(
                      { id: ticket.id, body: draft.trim() },
                      { onSuccess: () => setDraft('') },
                    )
                  }
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogBody>

          {/* The server says which moves are legal; this only draws them. */}
          <DialogFooter className="flex-wrap">
            {ticket.availableActions.map((name) => {
              const ui = ACTION_UI[name];
              const Icon = ui?.icon;
              return (
                <Button
                  key={name}
                  variant={ui?.variant ?? 'primary'}
                  disabled={busy}
                  onClick={() => run(name)}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  {ui?.label ?? name}
                </Button>
              );
            })}

            {ticket.status === 'awaiting_receipt' || ticket.status === 'in_progress' ? (
              <Button variant="secondary" disabled={busy} onClick={() => setReceiptOpen(true)}>
                <Receipt className="h-4 w-4" />
                {t.tenant.tickets.uploadReceipt}
              </Button>
            ) : null}

            <DialogClose asChild>
              <Button variant="ghost">{t.shell.close}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignVendorDialog ticket={ticket} open={assignOpen} onOpenChange={setAssignOpen} />
      <ReceiptDialog ticket={ticket} open={receiptOpen} onOpenChange={setReceiptOpen} />
    </>
  );
}

/* ── Assigning ─────────────────────────────────────────── */

const TRADE_FOR_CATEGORY: Record<string, VendorView['trade'][]> = {
  ac: ['ac_tech', 'handyman'],
  plumbing: ['plumber', 'handyman'],
  leak: ['plumber'],
  boiler: ['plumber', 'ac_tech'],
  electrical: ['electrician'],
  appliance: ['handyman', 'electrician'],
  lock: ['locksmith', 'handyman'],
  paint: ['painter', 'handyman'],
  other: ['handyman'],
};

function AssignVendorDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: TicketView;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: vendors = [] } = useVendors();
  const action = useTicketAction();
  const pushToast = useStore((s) => s.pushToast);

  const [vendorId, setVendorId] = React.useState('');
  const [slot, setSlot] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setVendorId('');
      setSlot(ticket.tenantAvailability[0] ?? '');
    }
  }, [open, ticket.id, ticket.tenantAvailability]);

  const relevant = React.useMemo(() => {
    const trades = TRADE_FOR_CATEGORY[ticket.category] ?? ['handyman'];
    return vendors.filter((v) => trades.includes(v.trade)).sort((a, b) => b.rating - a.rating);
  }, [vendors, ticket.category]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{t.tickets.assign.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div>
            <p className="mb-2 text-2xs font-bold text-ink-soft">{t.tickets.assign.pickVendor}</p>
            {relevant.length === 0 ? (
              <EmptyState title={t.vendors.empty} hint={t.vendors.emptyHint} compact />
            ) : (
              <ul className="space-y-2">
                {relevant.map((vendor) => (
                  <li key={vendor.id}>
                    <button
                      type="button"
                      onClick={() => setVendorId(vendor.id)}
                      aria-pressed={vendorId === vendor.id}
                      className={cn(
                        'press-sm w-full rounded-[var(--radius-control)] border p-3 text-start',
                        'transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out)]',
                        vendorId === vendor.id
                          ? 'border-ink bg-surface'
                          : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-ink">{vendor.name}</span>
                        {vendor.isNetworkPartner ? (
                          <Badge tone="signalSoft" size="sm">
                            {t.vendors.partner}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-signal text-signal" />
                          <Num board className="font-bold text-ink-soft">
                            {vendor.rating.toFixed(1)}
                          </Num>
                        </span>
                        <span>
                          {t.tickets.assign.responseTime}:{' '}
                          <Num board>{vendor.avgResponseHours}</Num> {t.vendors.hours}
                        </span>
                        <span>
                          {t.tickets.assign.calloutFee}:{' '}
                          <Num board>{formatAgorot(vendor.calloutFeeAgorot)}</Num>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-1 text-2xs font-bold text-ink-soft">{t.tickets.assign.pickSlot}</p>
            {ticket.tenantAvailability.length ? (
              <>
                <p className="mb-2 text-2xs text-muted">{t.tickets.assign.tenantSaid}</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {ticket.tenantAvailability.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSlot(option)}
                      aria-pressed={slot === option}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-2xs font-semibold transition-colors duration-150',
                        slot === option
                          ? 'border-ink bg-ink text-on-ink'
                          : 'border-line text-ink-soft hover:border-line-strong',
                      )}
                    >
                      <Num board>
                        {formatWeekdayDate(option)} · {formatTime(option)}
                      </Num>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <Field label={t.tickets.assign.customSlot} htmlFor="custom-slot">
              <Input
                id="custom-slot"
                type="datetime-local"
                dir="ltr"
                className="num"
                value={slot ? slot.slice(0, 16) : ''}
                onChange={(e) => setSlot(new Date(e.target.value).toISOString())}
              />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={!vendorId || !slot || action.isPending}
            onClick={() =>
              action.mutate(
                {
                  id: ticket.id,
                  action: 'assign',
                  body: { vendorId, scheduledAt: new Date(slot).toISOString() },
                },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    pushToast(t.tickets.assign.done, 'success');
                  },
                  onError: () => pushToast(t.auth.error.validation_failed, 'alert'),
                },
              )
            }
          >
            {t.tickets.assign.confirm}
          </Button>
          <DialogClose asChild>
            <Button variant="secondary">{t.ui.cancel}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Receipt ───────────────────────────────────────────── */

export function ReceiptDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: TicketView;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const upload = useUploadReceipt();
  const pushToast = useStore((s) => s.pushToast);
  const [amount, setAmount] = React.useState('');

  React.useEffect(() => {
    if (open) setAmount('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.tenant.tickets.uploadReceipt}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field
            label={t.tenant.tickets.receiptAmount}
            hint={t.tenant.tickets.receiptHint}
            htmlFor="receipt-amount"
          >
            <Input
              id="receipt-amount"
              type="number"
              min={1}
              dir="ltr"
              className="num"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={!Number(amount) || upload.isPending}
            onClick={() =>
              upload.mutate(
                /* Typed in shekels, stored in agorot — converted once, here. */
                { id: ticket.id, amountAgorot: toAgorot(Number(amount)) },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    pushToast(t.tickets.detail.expenseCreated, 'success');
                  },
                  onError: () => pushToast(t.auth.error.forbidden, 'alert'),
                },
              )
            }
          >
            {t.tenant.tickets.uploadReceipt}
          </Button>
          <DialogClose asChild>
            <Button variant="secondary">{t.ui.cancel}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { useConfirmSlot };
