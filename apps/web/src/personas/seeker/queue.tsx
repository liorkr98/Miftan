import { useNavigate } from 'react-router-dom';
import { t, formatAge, formatUntil, type SeekerLead, type TrackRow } from '@miftan/shared';
import { useLeads, useLeaveQueue } from '@/api/hooks';
import { useStore } from '@/data/store';
import { DepartureTrack } from '@/components/shared/departure-track';
import { OfferRail } from '@/components/shared/revenue';
import { AvailabilityChip, LeadStageBadge } from '@/components/shared/status';
import { Money, Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/shared/skeleton';
import { MapPin } from 'lucide-react';

export function SeekerQueue() {
  const navigate = useNavigate();
  const { data: leads = [], isLoading, isError, refetch } = useLeads();
  const leaveQueue = useLeaveQueue();
  const pushToast = useStore((s) => s.pushToast);

  /**
   * `/leads` answers in whichever role you hold per row, so an account that
   * also lets flats gets owner rows here too. This screen is "queues I am in",
   * which is the seeker half.
   */
  const mine = (leads.filter((l) => l.scope === 'seeker') as SeekerLead[])
    .slice()
    .sort((a, b) =>
      (a.availability.date ?? '9999').localeCompare(b.availability.date ?? '9999'),
    );

  const trackRows: TrackRow[] = mine.map((lead) => ({
    id: lead.id,
    property_id: lead.propertyId,
    label: lead.propertyLabel,
    sublabel: `${t.seeker.queue.position} ${lead.queuePosition}`,
    from: new Date().toISOString().slice(0, 10),
    until: lead.availability.kind === 'now' ? undefined : (lead.availability.date ?? undefined),
    tone: lead.availability.kind === 'now' ? 'open' : lead.watchOnly ? 'muted' : 'signal',
    confidence: lead.availability.confidence,
    meta: String(Math.round(lead.monthlyRentAgorot / 100)),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6">
      <PageHeader title={t.seeker.queue.title} subtitle={t.seeker.queue.subtitle} />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
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
              {mine.map((lead) => (
                <li
                  key={lead.id}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line p-3"
                >
                  {lead.photo ? (
                    <img
                      src={lead.photo}
                      alt=""
                      loading="lazy"
                      className="h-20 w-24 shrink-0 rounded-[8px] object-cover"
                    />
                  ) : (
                    <div className="h-20 w-24 shrink-0 rounded-[8px] bg-surface-sunk" />
                  )}

                  <div className="min-w-40 flex-1">
                    <button
                      type="button"
                      onClick={() => navigate(`/search/${lead.propertyId}`)}
                      className="block truncate text-sm font-bold text-ink underline-offset-2 hover:underline"
                    >
                      {lead.propertyLabel}
                    </button>
                    <p className="truncate text-2xs text-muted">
                      {lead.neighborhood} · {lead.city}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5">
                      <AvailabilityChip
                        kind={lead.availability.kind}
                        date={lead.availability.date ?? undefined}
                        confidence={lead.availability.confidence}
                        size="sm"
                      />
                      {lead.watchOnly ? (
                        <Badge tone="neutral" size="sm">
                          {t.seeker.queue.watchingOnly}
                        </Badge>
                      ) : (
                        <LeadStageBadge stage={lead.stage} size="sm" />
                      )}
                    </p>
                  </div>

                  {!lead.watchOnly ? (
                    <div className="text-center">
                      <p className="text-2xs text-muted">{t.seeker.queue.position}</p>
                      <p className="flex items-baseline justify-center gap-0.5">
                        <Num board className="text-xl font-semibold text-ink">
                          {lead.queuePosition}
                        </Num>
                        <span className="text-2xs text-muted">
                          {t.seeker.queue.outOf} <Num board>{lead.queueLength}</Num>
                        </span>
                      </p>
                    </div>
                  ) : null}

                  <div className="text-end">
                    <Money agorot={lead.monthlyRentAgorot} board className="text-sm font-bold text-ink" />
                    <p className="text-2xs text-muted">
                      {lead.availability.date ? formatUntil(lead.availability.date) : t.availability.now}
                    </p>
                    <p className="text-2xs text-muted">
                      {t.seeker.queue.waitingSince} {formatAge(lead.createdAt)}
                    </p>
                  </div>

                  <div className="flex w-full gap-2 border-t border-line pt-2.5 sm:w-auto sm:border-0 sm:pt-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/search/${lead.propertyId}`)}
                    >
                      {t.seeker.queue.viewListing}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={leaveQueue.isPending && leaveQueue.variables === lead.id}
                      onClick={() => {
                        leaveQueue.mutate(lead.id, {
                          onSuccess: () => pushToast(t.seeker.queue.left),
                        });
                      }}
                    >
                      {t.seeker.queue.leave}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <OfferRail placement="queue" audience="seeker" />
        </>
      )}
    </div>
  );
}
