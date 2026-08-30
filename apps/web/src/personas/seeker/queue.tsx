import { useNavigate } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t, formatAge, formatUntil, type TrackRow } from '@miftan/shared';
import { availabilityKind, leaseForProperty } from '@/data/selectors';
import { DepartureTrack } from '@/components/shared/departure-track';
import { OfferRail } from '@/components/shared/revenue';
import { AvailabilityChip, LeadStageBadge } from '@/components/shared/status';
import { Money, Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/shared/skeleton';
import { useDelayedReady } from '@/lib/use-delayed-ready';
import { MapPin } from 'lucide-react';

export function SeekerQueue() {
  const navigate = useNavigate();
  const ready = useDelayedReady();
  const { properties, leases, leads, currentSeekerId } = useStoreShallow((s) => ({
    properties: s.properties,
    leases: s.leases,
    leads: s.leads,
    currentSeekerId: s.currentSeekerId,
  }));
  const leaveQueue = useStore((s) => s.leaveQueue);
  const pushToast = useStore((s) => s.pushToast);

  const mine = leads
    .filter((l) => l.seeker_id === currentSeekerId)
    .map((lead) => ({ lead, property: properties.find((p) => p.id === lead.property_id) }))
    .filter((row): row is { lead: (typeof leads)[number]; property: (typeof properties)[number] } =>
      Boolean(row.property),
    )
    .sort((a, b) =>
      (a.property.available_from ?? '9999').localeCompare(b.property.available_from ?? '9999'),
    );

  /* The queue rendered on the same axis as everything else */
  const trackRows: TrackRow[] = mine.map(({ lead, property }) => ({
    id: lead.id,
    property_id: property.id,
    label: `${property.address.street} ${property.address.number}`,
    sublabel: `${t.seeker.queue.position} ${lead.queue_position}`,
    from: new Date().toISOString().slice(0, 10),
    until: property.status === 'vacant' ? undefined : property.available_from,
    tone: property.status === 'vacant' ? 'open' : lead.watch_only ? 'muted' : 'signal',
    confidence: property.availability_confidence,
    meta: String(property.monthly_rent),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6">
      <PageHeader title={t.seeker.queue.title} subtitle={t.seeker.queue.subtitle} />

      {!ready ? (
        <ListSkeleton rows={4} />
      ) : mine.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t.seeker.queue.empty}
          hint={t.seeker.queue.emptyHint}
          action={t.seeker.queue.emptyAction}
          onAction={() => navigate('/search')}
        />
      ) : (
        <>
          <section>
            <SectionTitle aside={<span className="text-2xs text-muted">{t.track.axisHint}</span>}>
              {t.track.title}
            </SectionTitle>
            <DepartureTrack
              rows={trackRows}
              months={14}
              showRent
              dense
              onRowClick={(row) => navigate(`/search/${row.property_id}`)}
            />
          </section>

          <section>
            <SectionTitle>
              {t.seeker.queue.title} · <Num board>{mine.length}</Num>
            </SectionTitle>
            <ul className="space-y-2.5">
              {mine.map(({ lead, property }) => {
                const kind = availabilityKind(property, leaseForProperty(leases, property.id));
                const total = leads.filter(
                  (l) => l.property_id === property.id && !l.watch_only,
                ).length;
                return (
                  <li
                    key={lead.id}
                    className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line p-3"
                  >
                    <img
                      src={property.photos[0]}
                      alt=""
                      loading="lazy"
                      className="h-20 w-24 shrink-0 rounded-[8px] object-cover"
                    />

                    <div className="min-w-40 flex-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/search/${property.id}`)}
                        className="block truncate text-sm font-bold text-ink underline-offset-2 hover:underline"
                      >
                        {property.address.street} {property.address.number}
                      </button>
                      <p className="truncate text-2xs text-muted">
                        {property.address.neighborhood} · {property.address.city}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5">
                        <AvailabilityChip kind={kind} date={property.available_from}
              confidence={property.availability_confidence} size="sm" />
                        {lead.watch_only ? (
                          <Badge tone="neutral" size="sm">
                            {t.seeker.queue.watchingOnly}
                          </Badge>
                        ) : (
                          <LeadStageBadge stage={lead.stage} size="sm" />
                        )}
                      </p>
                    </div>

                    {!lead.watch_only ? (
                      <div className="text-center">
                        <p className="text-2xs text-muted">{t.seeker.queue.position}</p>
                        <p className="flex items-baseline justify-center gap-0.5">
                          <Num board className="text-xl font-semibold text-ink">
                            {lead.queue_position}
                          </Num>
                          <span className="text-2xs text-muted">
                            {t.seeker.queue.outOf} <Num board>{total}</Num>
                          </span>
                        </p>
                      </div>
                    ) : null}

                    <div className="text-end">
                      <Money value={property.monthly_rent} board className="text-sm font-bold text-ink" />
                      <p className="text-2xs text-muted">
                        {property.available_from
                          ? formatUntil(property.available_from)
                          : t.availability.now}
                      </p>
                      <p className="text-2xs text-muted">
                        {t.seeker.queue.waitingSince} {formatAge(lead.created_at)}
                      </p>
                    </div>

                    <div className="flex w-full gap-2 border-t border-line pt-2.5 sm:w-auto sm:border-0 sm:pt-0">
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/search/${property.id}`)}>
                        {t.seeker.queue.viewListing}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          leaveQueue(lead.id);
                          pushToast(t.seeker.queue.left);
                        }}
                      >
                        {t.seeker.queue.leave}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <OfferRail placement="queue" audience="seeker" />
        </>
      )}
    </div>
  );
}
