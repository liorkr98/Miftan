import * as React from 'react';
import { useStore } from '@/data/store';
import { t, type Trade, type VendorView } from '@miftan/shared';
import { useProperties, useVendors } from '@/api/hooks';
import { Money, Num, PageHeader, Phone } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui/field';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ListSkeleton } from '@/components/shared/skeleton';
import { RevenueMarker } from '@/components/shared/revenue';
import { cn } from '@/lib/utils';
import { Info, Phone as PhoneIcon, Star, Users } from 'lucide-react';

type Sort = 'rating' | 'response' | 'fee';

export function OwnerVendors() {
  const { data: vendors = [], isLoading, isError, refetch } = useVendors();
  const { data: properties = [] } = useProperties();
  const pushToast = useStore((s) => s.pushToast);

  const owned = properties.filter((p) => p.scope === 'owner');

  const [trade, setTrade] = React.useState<Trade | 'all'>('all');
  const [area, setArea] = React.useState('all');
  const [sort, setSort] = React.useState<Sort>('rating');
  const [booking, setBooking] = React.useState<VendorView | null>(null);
  const [disclosureOpen, setDisclosureOpen] = React.useState(false);

  const areas = React.useMemo(() => [...new Set(vendors.flatMap((v) => v.areas))], [vendors]);

  const rows = React.useMemo(() => {
    const filtered = vendors.filter(
      (v) => (trade === 'all' || v.trade === trade) && (area === 'all' || v.areas.includes(area)),
    );
    /* Network partners are NOT boosted — the sort is the same for everyone,
       which is exactly what the disclosure claims. */
    return filtered.slice().sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating;
      if (sort === 'response') return a.avgResponseHours - b.avgResponseHours;
      return a.calloutFeeAgorot - b.calloutFeeAgorot;
    });
  }, [vendors, trade, area, sort]);

  const filtered = trade !== 'all' || area !== 'all';

  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader title={t.vendors.title} subtitle={t.vendors.subtitle} />

      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-line bg-signal-soft px-3.5 py-2.5">
        <Badge tone="signal" size="sm">
          {t.vendors.partner}
        </Badge>
        <p className="flex-1 text-xs text-signal-deep">{t.vendors.partnerDisclosure}</p>
        <RevenueMarker streamId="rs-vendor" />
        <Button variant="quiet" size="sm" onClick={() => setDisclosureOpen(true)}>
          <Info className="h-3.5 w-3.5" />
          {t.ui.showMore}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t.vendors.filterTrade} className="w-44">
          <Select value={trade} onValueChange={(v) => setTrade(v as Trade | 'all')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.vendors.allTrades}</SelectItem>
              {(Object.keys(t.trade) as Trade[]).map((tr) => (
                <SelectItem key={tr} value={tr}>
                  {t.trade[tr]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.vendors.filterArea} className="w-44">
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.vendors.allAreas}</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.vendors.sortBy} className="w-40">
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">{t.vendors.sortRating}</SelectItem>
              <SelectItem value="response">{t.vendors.sortResponse}</SelectItem>
              <SelectItem value="fee">{t.vendors.sortFee}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t.vendors.empty}
          hint={t.vendors.emptyHint}
          action={filtered ? t.properties.clearFilters : t.vendors.addVendor}
          onAction={
            filtered
              ? () => {
                  setTrade('all');
                  setArea('all');
                }
              : () => pushToast(t.vendors.addVendor)
          }
        />
      ) : (
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {rows.map((vendor) => (
            <li
              key={vendor.id}
              className={cn(
                'flex flex-col rounded-[var(--radius-card)] border p-4',
                vendor.isNetworkPartner ? 'border-signal/45' : 'border-line',
              )}
            >
              <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-ink">{vendor.name}</h3>
                  <p className="text-2xs text-muted">{t.trade[vendor.trade]}</p>
                </div>
                {vendor.isNetworkPartner ? (
                  <Badge tone="signal" size="sm">
                    {t.vendors.partner}
                  </Badge>
                ) : null}
              </div>

              <dl className="mt-2 grid grid-cols-2 gap-y-2 text-2xs">
                <Stat
                  label={t.vendors.rating}
                  value={
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-signal text-signal" />
                      <Num board>{vendor.rating.toFixed(1)}</Num>
                    </span>
                  }
                />
                <Stat
                  label={t.vendors.responseTime}
                  value={
                    <>
                      <Num board>{vendor.avgResponseHours}</Num> {t.vendors.hours}
                    </>
                  }
                />
                <Stat
                  label={t.vendors.calloutFee}
                  value={<Money agorot={vendor.calloutFeeAgorot} board />}
                />
                <Stat label={t.vendors.jobsDoneForYou} value={<Num board>{vendor.jobsDone}</Num>} />
              </dl>

              <p className="mt-2.5 text-2xs text-muted">
                {t.vendors.areas}: {vendor.areas.join(' · ')}
              </p>
              {vendor.note ? (
                <p className="mt-1.5 text-2xs leading-4 text-ink-soft">{vendor.note}</p>
              ) : null}

              <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                <Button size="sm" onClick={() => setBooking(vendor)}>
                  {t.vendors.book}
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <a href={`tel:+972${vendor.phone.replace(/\D/g, '').replace(/^0/, '')}`}>
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {t.vendors.call}
                  </a>
                </Button>
                <Phone value={vendor.phone} className="ms-auto text-2xs text-muted" />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(booking)} onOpenChange={(v) => !v && setBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.vendors.book}</DialogTitle>
          </DialogHeader>
          {booking ? (
            <DialogBody className="space-y-4">
              <div className="rounded-[var(--radius-control)] bg-surface p-3">
                <p className="text-sm font-bold text-ink">{booking.name}</p>
                <p className="text-2xs text-muted">
                  {t.trade[booking.trade]} · {t.vendors.calloutFee}{' '}
                  <Money agorot={booking.calloutFeeAgorot} board />
                </p>
              </div>
              <Field label={t.properties.address}>
                <Select defaultValue={owned[0]?.id}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {owned.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address.street} {p.address.number}, {p.address.neighborhood}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t.tickets.detail.writeMessage}>
                <Textarea placeholder={t.tickets.detail.writeMessage} />
              </Field>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => {
                pushToast(t.tickets.assign.done, 'success');
                setBooking(null);
              }}
            >
              {t.vendors.book}
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">{t.ui.cancel}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disclosureOpen} onOpenChange={setDisclosureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.vendors.partner}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm leading-6 text-ink-soft">{t.vendors.partnerExplainer}</p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button>{t.shell.close}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-bold text-ink">{value}</dd>
    </div>
  );
}
