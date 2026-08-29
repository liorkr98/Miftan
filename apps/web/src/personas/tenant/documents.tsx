import { useStore, useStoreShallow } from '@/data/store';
import { t, formatDate, formatMonthYear } from '@miftach/shared';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Receipt } from 'lucide-react';

export function TenantDocuments() {
  const { leases, tickets, rentPayments, currentTenantId } = useStoreShallow((s) => ({
    leases: s.leases,
    tickets: s.tickets,
    rentPayments: s.rentPayments,
    currentTenantId: s.currentTenantId,
  }));
  const pushToast = useStore((s) => s.pushToast);

  const lease = leases.find((l) => l.tenant_id === currentTenantId);
  const receipts = tickets.filter((tk) => tk.tenant_id === currentTenantId && tk.receipt);
  const payments = lease
    ? rentPayments.filter((p) => p.lease_id === lease.id).sort((a, b) => b.month.localeCompare(a.month))
    : [];

  if (!lease) {
    return <EmptyState icon={FileText} title={t.tenant.documents.empty} hint={t.tenant.documents.emptyHint} />;
  }

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
                <Num board>{formatDate(lease.start_date)}</Num> ·{' '}
                <Num board>
                  {formatDate(lease.start_date)} — {formatDate(lease.end_date)}
                </Num>
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => pushToast(t.ui.demoNote)}
            >
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
                    src={ticket.receipt!.file}
                    alt=""
                    loading="lazy"
                    className="h-16 w-12 shrink-0 rounded-[4px] border border-line object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink">{ticket.title}</p>
                    <p className="text-2xs text-muted">
                      <Num board>{formatDate(ticket.receipt!.uploaded_at)}</Num>
                    </p>
                    <Money
                      value={ticket.receipt!.amount}
                      board
                      className="text-sm font-bold text-ink"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[28rem] border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface text-2xs text-muted">
                  <th className="p-3 text-start font-bold">{t.tenant.documents.month}</th>
                  <th className="p-3 text-start font-bold">{t.finance.expected}</th>
                  <th className="p-3 text-start font-bold">{t.finance.paid}</th>
                  <th className="p-3 text-start font-bold">{t.tenant.documents.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((payment) => {
                  const state =
                    payment.paid >= payment.due ? 'paid' : payment.paid > 0 ? 'partial' : 'unpaid';
                  return (
                    <tr key={payment.id} className="text-sm">
                      <td className="p-3 text-ink">{formatMonthYear(`${payment.month}-01`)}</td>
                      <td className="p-3">
                        <Money value={payment.due} board className="text-ink-soft" />
                      </td>
                      <td className="p-3">
                        <Money value={payment.paid} board className="font-bold text-ink" />
                      </td>
                      <td className="p-3">
                        <Badge
                          tone={
                            state === 'paid' ? 'openSoft' : state === 'partial' ? 'signalSoft' : 'alertSoft'
                          }
                          size="sm"
                        >
                          {state === 'paid'
                            ? t.finance.paid
                            : state === 'partial'
                              ? t.finance.partial
                              : t.finance.unpaid}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
