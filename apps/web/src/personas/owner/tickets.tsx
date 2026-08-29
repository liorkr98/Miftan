import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t, formatAge, formatDateTime, formatWeekdayDate, formatTime, type Ticket, type TicketStatus, type Vendor } from '@miftach/shared';
import { Money, Num, PageHeader, Phone } from '@/components/shared/typography';
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
import { useDelayedReady } from '@/lib/use-delayed-ready';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  ClipboardCheck,
  Image as ImageIcon,
  Receipt,
  Send,
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

export function OwnerTickets() {
  const ready = useDelayedReady();
  const [params, setParams] = useSearchParams();
  const { tickets, properties, vendors } = useStoreShallow((s) => ({
    tickets: s.tickets,
    properties: s.properties,
    vendors: s.vendors,
  }));

  const openId = params.get('ticket');
  const openTicket = tickets.find((tk) => tk.id === openId);

  const propertyById = React.useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const vendorById = React.useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const open = tickets.filter((tk) => tk.status !== 'closed');
  const urgent = open.filter((tk) => tk.severity === 'urgent');

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('ticket', id);
    else next.delete('ticket');
    setParams(next, { replace: true });
  };

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

      {!ready ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="hide-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {COLUMNS.map((status) => {
            const column = tickets
              .filter((tk) => tk.status === status)
              .sort(
                (a, b) =>
                  (b.severity === 'urgent' ? 1 : 0) - (a.severity === 'urgent' ? 1 : 0) ||
                  a.created_at.localeCompare(b.created_at),
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
                    column.map((ticket) => {
                      const property = propertyById.get(ticket.property_id);
                      const vendor = ticket.vendor_id ? vendorById.get(ticket.vendor_id) : undefined;
                      return (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() => setOpen(ticket.id)}
                          className={cn(
                            'w-full rounded-[var(--radius-control)] border bg-bg p-2.5 text-start transition-colors duration-150 hover:border-line-strong',
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
                            {property ? `${property.address.street} ${property.address.number}` : ''}
                          </span>
                          <span className="mt-2 flex items-center gap-2 text-2xs text-muted">
                            {ticket.photos.length ? (
                              <span className="flex items-center gap-0.5">
                                <ImageIcon className="h-3 w-3" />
                                <Num board>{ticket.photos.length}</Num>
                              </span>
                            ) : null}
                            <span>{formatAge(ticket.created_at)}</span>
                            {vendor ? (
                              <span className="ms-auto truncate font-semibold text-ink-soft">
                                {vendor.name.split(' ')[0]}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TicketDrawer ticket={openTicket} onClose={() => setOpen(null)} />
    </div>
  );
}

/* ── Ticket detail: thread, actions, receipt ───────────── */

function TicketDrawer({ ticket, onClose }: { ticket?: Ticket; onClose: () => void }) {
  const { properties, tenants, vendors, expenses } = useStoreShallow((s) => ({
    properties: s.properties,
    tenants: s.tenants,
    vendors: s.vendors,
    expenses: s.expenses,
  }));
  const approveTicket = useStore((s) => s.approveTicket);
  const rejectTicket = useStore((s) => s.rejectTicket);
  const startWork = useStore((s) => s.startWork);
  const requestReceipt = useStore((s) => s.requestReceipt);
  const reopenTicket = useStore((s) => s.reopenTicket);
  const addTicketMessage = useStore((s) => s.addTicketMessage);
  const pushToast = useStore((s) => s.pushToast);

  const [draft, setDraft] = React.useState('');
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [receiptOpen, setReceiptOpen] = React.useState(false);

  React.useEffect(() => {
    setDraft('');
  }, [ticket?.id]);

  if (!ticket) return null;

  const property = properties.find((p) => p.id === ticket.property_id);
  const tenant = tenants.find((x) => x.id === ticket.tenant_id);
  const vendor = vendors.find((v) => v.id === ticket.vendor_id);
  const expense = expenses.find((e) => e.id === ticket.expense_id);

  const send = () => {
    if (!draft.trim()) return;
    addTicketMessage(ticket.id, 'owner', draft.trim());
    setDraft('');
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
              {property ? `${property.address.street} ${property.address.number}` : ''} · {tenant?.name} ·{' '}
              {formatAge(ticket.created_at)}
            </p>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {/* Assignment + receipt summary */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-control)] bg-surface p-3">
                <p className="mb-1 text-2xs font-bold text-ink-soft">{t.tickets.detail.details}</p>
                {vendor ? (
                  <>
                    <p className="text-sm font-bold text-ink">{vendor.name}</p>
                    <p className="text-2xs text-muted">{t.trade[vendor.trade]}</p>
                    <Phone value={vendor.phone} className="mt-1 block text-2xs text-muted" />
                    {ticket.scheduled_at ? (
                      <p className="mt-1.5 text-2xs text-ink-soft">
                        {t.tickets.scheduled}:{' '}
                        <Num board className="font-bold">
                          {formatDateTime(ticket.scheduled_at)}
                        </Num>
                      </p>
                    ) : null}
                    {ticket.tenant_confirmed_slot ? (
                      <Badge tone="openSoft" size="sm" className="mt-1.5">
                        <CheckCircle2 className="h-3 w-3" />
                        {t.tenant.tickets.slotConfirmed}
                      </Badge>
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
                    <img
                      src={ticket.receipt.file}
                      alt=""
                      loading="lazy"
                      className="h-16 w-12 shrink-0 rounded-[4px] border border-line object-cover"
                    />
                    <div>
                      <Money value={ticket.receipt.amount} board className="text-base font-bold text-ink" />
                      <p className="text-2xs text-muted">
                        {t.tickets.detail.uploadedBy}{' '}
                        {ticket.receipt.uploaded_by === 'tenant' ? t.persona.tenant : vendor?.name}
                      </p>
                      {expense ? (
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

            {/* Tenant availability windows */}
            {ticket.tenant_availability.length > 0 && !ticket.scheduled_at ? (
              <div>
                <p className="mb-1.5 text-2xs font-bold text-ink-soft">
                  {t.tickets.detail.tenantAvailability}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.tenant_availability.map((slot) => (
                    <Badge key={slot} tone="outline" size="sm">
                      <Num board>
                        {formatWeekdayDate(slot)} · {formatTime(slot)}
                      </Num>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Thread */}
            <div>
              <p className="mb-2 text-2xs font-bold text-ink-soft">{t.tickets.detail.conversation}</p>
              <ul className="space-y-2.5">
                {ticket.messages.map((message, i) => (
                  <li
                    key={i}
                    className={cn(
                      'rounded-[var(--radius-control)] border p-2.5',
                      message.author_role === 'owner'
                        ? 'border-ink/15 bg-surface'
                        : message.author_role === 'vendor'
                          ? 'border-live/25 bg-live-soft'
                          : 'border-line bg-bg',
                    )}
                  >
                    <p className="mb-1 flex items-baseline justify-between gap-2 text-2xs">
                      <span className="font-bold text-ink">{message.author_name}</span>
                      <span className="text-muted">{formatAge(message.at)}</span>
                    </p>
                    <p className="text-sm leading-6 text-ink-soft">{message.body}</p>
                    {message.photos?.length ? (
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
                <Button size="icon" onClick={send} disabled={!draft.trim()} aria-label={t.tickets.detail.send}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogBody>

          {/* The action rail — exactly the actions valid for this status */}
          <DialogFooter className="flex-wrap">
            {ticket.status === 'new' ? (
              <>
                <Button onClick={() => approveTicket(ticket.id)}>
                  <ClipboardCheck className="h-4 w-4" />
                  {t.tickets.actions.approve}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    rejectTicket(ticket.id, t.tickets.actions.reject);
                    pushToast(t.tickets.actions.reject);
                  }}
                >
                  {t.tickets.actions.reject}
                </Button>
              </>
            ) : null}

            {ticket.status === 'approved' ? (
              <Button onClick={() => setAssignOpen(true)}>
                <UserCheck className="h-4 w-4" />
                {t.tickets.actions.assignVendor}
              </Button>
            ) : null}

            {ticket.status === 'assigned' ? (
              <>
                <Button onClick={() => startWork(ticket.id)}>
                  <Wrench className="h-4 w-4" />
                  {t.tickets.actions.markInProgress}
                </Button>
                <Button variant="secondary" onClick={() => setAssignOpen(true)}>
                  {t.tickets.actions.changeVendor}
                </Button>
              </>
            ) : null}

            {ticket.status === 'in_progress' ? (
              <Button onClick={() => requestReceipt(ticket.id)}>
                <Receipt className="h-4 w-4" />
                {t.tickets.actions.requestReceipt}
              </Button>
            ) : null}

            {ticket.status === 'awaiting_receipt' ? (
              <Button onClick={() => setReceiptOpen(true)}>
                <Receipt className="h-4 w-4" />
                {t.tenant.tickets.uploadReceipt}
              </Button>
            ) : null}

            {ticket.status === 'closed' ? (
              <Button variant="secondary" onClick={() => reopenTicket(ticket.id)}>
                {t.tickets.actions.reopen}
              </Button>
            ) : null}

            <DialogClose asChild>
              <Button variant="ghost">{t.shell.close}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignVendorDialog
        ticket={ticket}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />

      <ReceiptDialog ticket={ticket} open={receiptOpen} onOpenChange={setReceiptOpen} />
    </>
  );
}

/* ── Vendor assignment ─────────────────────────────────── */

const TRADE_FOR_CATEGORY: Record<string, Vendor['trade'][]> = {
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
  ticket: Ticket;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { vendors, properties } = useStoreShallow((s) => ({
    vendors: s.vendors,
    properties: s.properties,
  }));
  const assignVendor = useStore((s) => s.assignVendor);
  const pushToast = useStore((s) => s.pushToast);

  const property = properties.find((p) => p.id === ticket.property_id);
  const [vendorId, setVendorId] = React.useState<string>('');
  const [slot, setSlot] = React.useState<string>(ticket.tenant_availability[0] ?? '');
  const [custom, setCustom] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setVendorId('');
      setSlot(ticket.tenant_availability[0] ?? '');
      setCustom('');
    }
  }, [open, ticket.id, ticket.tenant_availability]);

  const relevant = React.useMemo(() => {
    const trades = TRADE_FOR_CATEGORY[ticket.category] ?? ['handyman'];
    return vendors
      .filter((v) => trades.includes(v.trade))
      .filter((v) => !property || v.areas.includes(property.address.city))
      .sort((a, b) => b.rating - a.rating);
  }, [vendors, ticket.category, property]);

  const chosenSlot = custom || slot;

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
                        'w-full rounded-[var(--radius-control)] border p-3 text-start transition-colors duration-150',
                        vendorId === vendor.id
                          ? 'border-ink bg-surface'
                          : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-ink">{vendor.name}</span>
                        {vendor.is_network_partner ? (
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
                          <Num board>{vendor.avg_response_hours}</Num> {t.vendors.hours}
                        </span>
                        <span>
                          {t.tickets.assign.calloutFee}: <Money value={vendor.callout_fee} board />
                        </span>
                        <span>
                          <Num board>{vendor.jobs_done}</Num> {t.tickets.assign.jobsForYou}
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
            <p className="mb-2 text-2xs text-muted">{t.tickets.assign.tenantSaid}</p>
            <div className="flex flex-wrap gap-1.5">
              {ticket.tenant_availability.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSlot(option);
                    setCustom('');
                  }}
                  aria-pressed={chosenSlot === option}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-2xs font-semibold transition-colors duration-150',
                    chosenSlot === option
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
            <Field label={t.tickets.assign.customSlot} htmlFor="custom-slot" className="mt-3">
              <Input
                id="custom-slot"
                type="datetime-local"
                dir="ltr"
                className="num"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={!vendorId || !chosenSlot}
            onClick={() => {
              assignVendor(ticket.id, vendorId, new Date(chosenSlot).toISOString());
              onOpenChange(false);
              pushToast(t.tickets.assign.done, 'success');
            }}
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

/* ── Receipt upload — closes the ticket and books the expense ── */

export function ReceiptDialog({
  ticket,
  open,
  onOpenChange,
  by = 'vendor',
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  by?: 'tenant' | 'vendor';
}) {
  const uploadReceipt = useStore((s) => s.uploadReceipt);
  const pushToast = useStore((s) => s.pushToast);
  const vendors = useStore((s) => s.vendors);
  const vendor = vendors.find((v) => v.id === ticket.vendor_id);

  const [amount, setAmount] = React.useState(String(vendor?.callout_fee ?? 350));
  const [attached, setAttached] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAmount(String(vendor?.callout_fee ?? 350));
      setAttached(false);
    }
  }, [open, vendor?.callout_fee]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.tenant.tickets.uploadReceipt}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label={t.tenant.tickets.receiptAmount} htmlFor="receipt-amount">
            <Input
              id="receipt-amount"
              type="number"
              dir="ltr"
              className="num"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>

          <button
            type="button"
            onClick={() => setAttached(true)}
            className={cn(
              'flex w-full flex-col items-center gap-1.5 rounded-[var(--radius-control)] border border-dashed px-4 py-6 transition-colors duration-150',
              attached ? 'border-open bg-open-soft' : 'border-line hover:border-line-strong',
            )}
          >
            {attached ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-open" />
                <span className="text-xs font-bold text-open">{t.tenant.report.photoAdded}</span>
              </>
            ) : (
              <>
                <Receipt className="h-5 w-5 text-line-strong" />
                <span className="text-xs font-bold text-ink">{t.tenant.report.addPhoto}</span>
                <span className="text-2xs text-muted">{t.ui.demoNote}</span>
              </>
            )}
          </button>

          <p className="text-2xs leading-5 text-muted">{t.tenant.tickets.receiptHint}</p>
        </DialogBody>
        <DialogFooter>
          <Button
            disabled={!attached || !Number(amount)}
            onClick={() => {
              uploadReceipt(ticket.id, Number(amount), by);
              onOpenChange(false);
              pushToast(t.tickets.detail.expenseCreated, 'success');
            }}
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
