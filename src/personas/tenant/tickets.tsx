import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t } from '@/i18n/he';
import { OPEN_TICKET_STATUSES } from '@/data/selectors';
import { Money, Num, PageHeader, Phone } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { SeverityBadge, TicketStatusBadge } from '@/components/shared/status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReceiptDialog } from '@/personas/owner/tickets';
import { ListSkeleton } from '@/components/shared/skeleton';
import { useDelayedReady } from '@/lib/use-delayed-ready';
import { formatAge, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Ticket } from '@/types';
import { CalendarCheck2, CheckCircle2, ListChecks, Receipt, Wrench } from 'lucide-react';

export function TenantTickets() {
  const navigate = useNavigate();
  const ready = useDelayedReady();
  const { tickets, vendors, currentTenantId } = useStoreShallow((s) => ({
    tickets: s.tickets,
    vendors: s.vendors,
    currentTenantId: s.currentTenantId,
  }));

  const mine = tickets
    .filter((tk) => tk.tenant_id === currentTenantId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const open = mine.filter((tk) => OPEN_TICKET_STATUSES.includes(tk.status));
  const closed = mine.filter((tk) => tk.status === 'closed');

  return (
    <div className="space-y-5">
      <PageHeader title={t.tenant.tickets.title} />

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">
            {t.tenant.tickets.openTab}
            {open.length ? <Num className="ms-1.5 text-2xs text-muted">{open.length}</Num> : null}
          </TabsTrigger>
          <TabsTrigger value="closed">
            {t.tenant.tickets.closedTab}
            {closed.length ? <Num className="ms-1.5 text-2xs text-muted">{closed.length}</Num> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          {!ready ? (
            <ListSkeleton rows={3} />
          ) : open.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title={t.tenant.tickets.empty}
              hint={t.tenant.tickets.emptyHint}
              action={t.tenant.tickets.emptyAction}
              onAction={() => navigate('/tenant/report')}
            />
          ) : (
            <ul className="space-y-3">
              {open.map((ticket) => (
                <TenantTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  vendorName={vendors.find((v) => v.id === ticket.vendor_id)?.name}
                  vendorPhone={vendors.find((v) => v.id === ticket.vendor_id)?.phone}
                />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="closed">
          {closed.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={t.tenant.tickets.emptyClosed}
              hint={t.tenant.tickets.emptyClosedHint}
            />
          ) : (
            <ul className="space-y-3">
              {closed.map((ticket) => (
                <TenantTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  vendorName={vendors.find((v) => v.id === ticket.vendor_id)?.name}
                  vendorPhone={vendors.find((v) => v.id === ticket.vendor_id)?.phone}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TenantTicketCard({
  ticket,
  vendorName,
  vendorPhone,
}: {
  ticket: Ticket;
  vendorName?: string;
  vendorPhone?: string;
}) {
  const confirmSlot = useStore((s) => s.confirmSlot);
  const addTicketMessage = useStore((s) => s.addTicketMessage);
  const pushToast = useStore((s) => s.pushToast);
  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  return (
    <li className="overflow-hidden rounded-[var(--radius-card)] border border-line">
      <div className="p-4">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={ticket.severity} size="sm" />
          <TicketStatusBadge status={ticket.status} size="sm" />
          <Badge tone="outline" size="sm">
            {t.ticketCategory[ticket.category]}
          </Badge>
          <span className="ms-auto text-2xs text-muted">{formatAge(ticket.created_at)}</span>
        </div>

        <h3 className="text-sm font-bold text-ink">{ticket.title}</h3>
        {ticket.description ? (
          <p className="mt-1 text-xs leading-5 text-muted">{ticket.description}</p>
        ) : null}

        {ticket.photos.length ? (
          <div className="mt-2.5 flex gap-1.5">
            {ticket.photos.map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                loading="lazy"
                className="h-16 w-16 rounded-[var(--radius-control)] border border-line object-cover"
              />
            ))}
          </div>
        ) : null}

        {/* Status-specific tenant affordances */}
        {ticket.status === 'new' ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <CalendarCheck2 className="h-3.5 w-3.5" />
            {t.tenant.tickets.awaitingApproval}
          </p>
        ) : null}

        {vendorName && ticket.scheduled_at ? (
          <div className="mt-3 rounded-[var(--radius-control)] bg-surface p-3">
            <p className="text-2xs text-muted">{t.tenant.tickets.vendorAssigned}</p>
            <p className="text-sm font-bold text-ink">{vendorName}</p>
            {vendorPhone ? <Phone value={vendorPhone} className="text-2xs text-muted" /> : null}
            <p className="mt-1.5 text-xs text-ink-soft">
              {t.tenant.tickets.eta}:{' '}
              <Num board className="font-bold">
                {formatDateTime(ticket.scheduled_at)}
              </Num>
            </p>

            {ticket.status !== 'closed' ? (
              ticket.tenant_confirmed_slot ? (
                <Badge tone="openSoft" size="sm" className="mt-2">
                  <CheckCircle2 className="h-3 w-3" />
                  {t.tenant.tickets.slotConfirmed}
                </Badge>
              ) : (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      confirmSlot(ticket.id);
                      pushToast(t.tenant.tickets.slotConfirmed, 'success');
                    }}
                  >
                    {t.tenant.tickets.confirmSlot}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      addTicketMessage(ticket.id, 'tenant', t.tenant.tickets.requestOther);
                      pushToast(t.tenant.tickets.requestOther);
                    }}
                  >
                    {t.tenant.tickets.requestOther}
                  </Button>
                </div>
              )
            ) : null}
          </div>
        ) : null}

        {ticket.status === 'awaiting_receipt' ? (
          <div className="mt-3">
            <Button size="sm" onClick={() => setReceiptOpen(true)}>
              <Receipt className="h-3.5 w-3.5" />
              {t.tenant.tickets.uploadReceipt}
            </Button>
            <p className="mt-1.5 text-2xs text-muted">{t.tenant.tickets.receiptHint}</p>
          </div>
        ) : null}

        {ticket.receipt ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-[var(--radius-control)] bg-surface p-3">
            <img
              src={ticket.receipt.file}
              alt=""
              loading="lazy"
              className="h-14 w-10 shrink-0 rounded-[4px] border border-line object-cover"
            />
            <div>
              <p className="text-2xs text-muted">{t.tickets.detail.receipt}</p>
              <Money value={ticket.receipt.amount} board className="text-sm font-bold text-ink" />
            </div>
            <Badge tone="openSoft" size="sm" className="ms-auto">
              {t.tenant.tickets.receiptUploaded}
            </Badge>
          </div>
        ) : null}
      </div>

      {/* Thread */}
      <div className="border-t border-line bg-surface">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-2xs font-bold text-ink-soft"
        >
          <span>
            {t.tickets.detail.conversation} · <Num board>{ticket.messages.length}</Num>
          </span>
          <span className="text-muted">{expanded ? t.ui.showLess : t.ui.showMore}</span>
        </button>
        {expanded ? (
          <ul className="space-y-2 px-4 pb-3">
            {ticket.messages.map((message, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-[var(--radius-control)] px-3 py-2',
                  message.author_role === 'tenant' ? 'bg-ink text-on-ink' : 'bg-bg',
                )}
              >
                <p
                  className={cn(
                    'mb-0.5 flex items-baseline justify-between gap-3 text-2xs',
                    message.author_role === 'tenant' ? 'text-on-ink-muted' : 'text-muted',
                  )}
                >
                  <span className="font-bold">{message.author_name}</span>
                  <span>{formatAge(message.at)}</span>
                </p>
                <p
                  className={cn(
                    'text-sm leading-6',
                    message.author_role === 'tenant' ? 'text-on-ink' : 'text-ink-soft',
                  )}
                >
                  {message.body}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ReceiptDialog ticket={ticket} open={receiptOpen} onOpenChange={setReceiptOpen} by="tenant" />
    </li>
  );
}
