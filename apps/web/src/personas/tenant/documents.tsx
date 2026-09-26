import { t, formatDate, formatMonthYear, type TenantProperty, type TenantRentPayment } from '@miftan/shared';
import { useProperties, useRentPayments, useTickets } from '@/api/hooks';
import { useStore } from '@/data/store';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Receipt, Wallet } from 'lucide-react';

export function TenantDocuments() {
  const {
    data: properties,
    isLoading: propertiesLoading,
    isError: propertiesError,
    refetch: refetchProperties,
  } = useProperties();
  const {
    data: tickets = [],
    isLoading: ticketsLoading,
    isError: ticketsError,
    refetch: refetchTickets,
  } = useTickets();
  const {
    data: payments = [],
    isLoading: paymentsLoading,
    isError: paymentsError,
    refetch: refetchPayments,
  } = useRentPayments();
  const pushToast = useStore((s) => s.pushToast);

  if (propertiesError || ticketsError || paymentsError) {
    return (
      <ErrorState
        onRetry={() => {
          void refetchProperties();
          void refetchTickets();
          void refetchPayments();
        }}
      />
    );
  }
  if (propertiesLoading || ticketsLoading || paymentsLoading) return <ListSkeleton rows={4} />;

  /**
   * `/properties` mixes every relationship this account holds. The lease
   * document belongs to the flat they rent — not to one they own.
   */
  const home = properties?.find((p): p is TenantProperty => p.scope === 'tenant');

  if (!home) {
    return <EmptyState icon={FileText} title={t.tenant.documents.empty} hint={t.tenant.documents.emptyHint} />;
  }

  /* Receipts live on tickets, not on a documents table. Owner-scope tickets
     on a mixed-role account are someone else's receipts. */
  const receipts = tickets.filter((tk) => tk.scope === 'tenant' && tk.receipt?.file);
  const myPayments = payments.filter((p): p is TenantRentPayment => p.scope === 'tenant');

  return (
    <div className="space-y-5">
      <PageHeader title={t.tenant.documents.title} subtitle={t.tenant.documents.mockNote} />

      <Tabs defaultValue="lease">
        <TabsList>
          <TabsTrigger value="lease">{t.tenant.documents.lease}</TabsTrigger>
          <TabsTrigger value="receipts">
            {t.tenant.documents.receipts}
            {receipts.length ? <Num className="ms-1.5 text-2xs text-muted">{receipts.length}</Num> : null}
          </TabsTrigger>
          <TabsTrigger value="payments">{t.tenant.documents.payments}</TabsTrigger>
        </TabsList>

        <TabsContent value="lease">
          <div className="flex items-center gap-3.5 rounded-[var(--radius-card)] border border-line p-4">
            <span className="grid h-12 w-10 shrink-0 place-items-center rounded-[6px] border border-line bg-surface">
              <FileText className="h-5 w-5 text-muted" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">{t.tenant.documents.lease}</p>
              <p className="text-2xs text-muted">
                {t.tenant.documents.signedOn}{' '}
                <Num board>{formatDate(home.lease.startDate)}</Num> ·{' '}
                <Num board>
                  {formatDate(home.lease.startDate)} — {formatDate(home.lease.endDate)}
                </Num>
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => pushToast(t.ui.demoNote)}>
              {t.tenant.documents.view}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="receipts">
          {receipts.length === 0 ? (
            <EmptyState icon={Receipt} title={t.tenant.documents.empty} hint={t.tenant.documents.emptyHint} />
          ) : (
            <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
              {receipts.map((ticket) => (
                <li
                  key={ticket.id}
                  className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line p-3"
                >
                  <img
                    src={ticket.receipt!.file!}
                    alt=""
                    loading="lazy"
                    className="h-16 w-12 shrink-0 rounded-[4px] border border-line object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink">{ticket.title}</p>
                    <p className="text-2xs text-muted">
                      <Num board>{formatDate(ticket.receipt!.uploadedAt)}</Num>
                    </p>
                    <Money agorot={ticket.receipt!.amountAgorot} board className="text-sm font-bold text-ink" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="payments">
          {myPayments.length === 0 ? (
            <EmptyState icon={Wallet} title={t.tenant.documents.paymentsEmpty} hint={t.tenant.documents.paymentsEmptyHint} />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
              {myPayments.map((row) => {
                const state = row.paidAgorot >= row.dueAgorot ? 'paid' : row.paidAgorot > 0 ? 'partial' : 'unpaid';
                return (
                  <li key={row.id} className="flex items-center justify-between gap-3 p-3.5">
                    <span>
                      <span className="block text-sm font-bold text-ink">{formatMonthYear(`${row.month}-01`)}</span>
                      <span className="block text-2xs text-muted">{t.paymentMethod[row.method]}</span>
                    </span>
                    <span className="text-end">
                      <Money agorot={row.paidAgorot} board className="block font-bold text-ink" />
                      <span className="text-2xs text-muted">
                        {state === 'paid'
                          ? t.finance.paid
                          : state === 'partial'
                            ? t.finance.partial
                            : t.finance.unpaid}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
