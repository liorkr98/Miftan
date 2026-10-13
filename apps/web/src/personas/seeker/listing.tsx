import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '@/data/store';
import {
  ApiError,
  t,
  formatDate,
  formatDateTime,
  formatFloor,
  formatRooms,
  formatSqm,
  type Amenity,
  type SeekerInquiry,
  type SeekerLead,
  type SeekerSlot,
  type TrackRow,
} from '@miftan/shared';
import { AVAILABILITY_TONE } from '@/data/selectors';
import {
  useApplyFromWatch,
  useAskAvailability,
  useInquiries,
  useLeads,
  useLeaveQueue,
  useProperty,
  useRecordListingView,
  useReserveQueue,
  useViewingAction,
  useViewings,
} from '@/api/hooks';
import { DepartureTrack } from '@/components/shared/departure-track';
import { AvailabilityChip } from '@/components/shared/status';
import { Money, Num, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
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
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Bell,
  BellOff,
  Check,
  Clock3,
  EyeOff,
  MapPinX,
  MessageCircleQuestion,
  Send,
  Users,
} from 'lucide-react';
import { Field, Input, Textarea } from '@/components/ui/field';
import { OfferRail } from '@/components/shared/revenue';
import { SlotGrid } from '@/components/shared/scheduling';
import { ListingStats } from '@/components/shared/listing-stats';

function amenityLabel(key: string): string {
  return key in t.amenity ? t.amenity[key as Amenity] : key;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function SeekerListing() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const pushToast = useStore((s) => s.pushToast);

  const { data: property, isLoading, isError, error, refetch } = useProperty(id);
  useRecordListingView(id, property?.scope === 'public');
  const { data: leads = [] } = useLeads();
  const { data: inquiries = [] } = useInquiries();
  const { data: viewing } = useViewings(id, { live: true });
  const applyFromWatch = useApplyFromWatch();
  const [changingViewing, setChangingViewing] = React.useState(false);
  const reserveQueue = useReserveQueue();
  const leaveQueue = useLeaveQueue();
  const askAvailability = useAskAvailability();
  const viewingAction = useViewingAction();

  const [photoIndex, setPhotoIndex] = React.useState(0);
  const [profileGateOpen, setProfileGateOpen] = React.useState(false);
  const [askOpen, setAskOpen] = React.useState(false);
  const [askText, setAskText] = React.useState('');
  const [askDate, setAskDate] = React.useState('');

  const mine = leads.find((l): l is SeekerLead => l.scope === 'seeker' && l.propertyId === id);
  const watching = Boolean(mine?.watchOnly);
  const reserved = Boolean(mine && !mine.watchOnly);
  const myInquiry = inquiries.find((x): x is SeekerInquiry => x.scope === 'seeker' && x.propertyId === id);

  const onReserveError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'forbidden' && /profile/i.test(err.message)) {
      setProfileGateOpen(true);
      return;
    }
    pushToast(t.auth.error.internal, 'alert');
  };

  const desiredMoveIn = askDate || property?.availability.date || todayIso();

  const onReserve = (watchOnly = false) => {
    reserveQueue.mutate(
      { propertyId: id, desiredMoveIn, watchOnly },
      {
        onSuccess: () => pushToast(watchOnly ? t.seeker.listing.watching : t.seeker.listing.reserved, 'success'),
        onError: onReserveError,
      },
    );
  };

  if (isError && error instanceof ApiError && error.code === 'not_found') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EmptyState
          icon={MapPinX}
          title={t.seeker.listing.notFound}
          hint={t.seeker.listing.notFoundHint}
          action={t.seeker.listing.backToSearch}
          onAction={() => navigate('/search')}
        />
      </div>
    );
  }
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading || !property) return <ListSkeleton rows={6} />;

  const kind = property.availability.kind;
  const undecided = kind === 'unknown' || kind === 'extending';
  const totalMonthlyAgorot =
    property.monthlyRentAgorot +
    Math.round(property.arnonaBimonthlyAgorot / 2) +
    property.vaadMonthlyAgorot;

  const trackRows: TrackRow[] = [
    {
      id: property.id,
      property_id: property.id,
      label: `${property.address.street} ${property.address.number}`,
      sublabel: property.address.neighborhood,
      from: todayIso(),
      until: property.availability.date ?? undefined,
      tone: AVAILABILITY_TONE[kind],
      confidence: property.availability.confidence,
    },
  ];

  const seekerSlots = (viewing?.slots ?? []).filter((s): s is SeekerSlot => s.scope === 'seeker');
  const myViewing = seekerSlots.find((s) => s.mine) ?? null;
  /* Someone following this flat, now that it has a date: one tap to apply. */
  const canApplyFromWatch = watching && mine && (kind === 'now' || kind === 'dated');

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
      <Button variant="quiet" size="sm" className="-ms-2 mb-2" onClick={() => navigate('/search')}>
        <ArrowRight className="h-3.5 w-3.5" />
        {t.seeker.listing.backToSearch}
      </Button>

      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line">
        {property.photos[photoIndex] ? (
          <img src={property.photos[photoIndex]} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div className="grid aspect-[16/9] place-items-center bg-surface text-xs text-muted">
            {t.unit.noPhotos}
          </div>
        )}
        {property.photos.length > 1 ? (
          <div className="flex gap-1.5 bg-surface p-2">
            {property.photos.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setPhotoIndex(i)}
                aria-label={`${t.unit.photos} ${i + 1}`}
                aria-pressed={photoIndex === i}
                className={cn(
                  'h-12 w-16 overflow-hidden rounded-[6px] border-2 transition-colors duration-150',
                  photoIndex === i ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-[-0.01em] text-ink">
            {property.address.street} {property.address.number}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {property.address.neighborhood} · {property.address.city}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {formatRooms(property.rooms)} · {formatSqm(property.sqm)} ·{' '}
            {formatFloor(property.floor, property.totalFloors)}
          </p>
        </div>
        <div className="text-end">
          <Money agorot={property.monthlyRentAgorot} board className="text-2xl font-bold text-ink" />
          <p className="text-2xs text-muted">{t.ui.perMonth}</p>
        </div>
      </header>

      <div className="mt-3">
        <AvailabilityChip
          kind={kind}
          date={property.availability.date ?? undefined}
          confidence={property.availability.confidence}
          size="lg"
          withCountdown
        />
      </div>

      <ListingStats viewCount={property.viewCount} watchCount={property.watchCount} className="mt-3" />

      <section className="mt-5">
        <SectionTitle aside={<span className="text-2xs text-muted">{t.track.axisHint}</span>}>
          {t.seeker.listing.availability}
        </SectionTitle>
        <DepartureTrack
          rows={trackRows}
          months={12}
          dense
          emptyTitle={t.availability.now}
          emptyHint={t.seeker.listing.queueEmptyHint}
        />
      </section>

      {undecided || myInquiry ? (
        <section
          className={cn(
            'mt-5 rounded-[var(--radius-card)] border p-4',
            myInquiry?.ownerReply ? 'border-line bg-surface' : 'border-live/40 bg-live-soft',
          )}
        >
          <div className="flex items-start gap-2.5">
            <Clock3
              className={cn('mt-0.5 h-4 w-4 shrink-0', myInquiry?.ownerReply ? 'text-muted' : 'text-live')}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink">
                {myInquiry?.ownerReply ? t.inquiries.seeker.answered : t.availability.askable}
              </h2>
              {!myInquiry?.ownerReply ? (
                <p className="mt-1 text-xs leading-5 text-ink-soft">{t.inquiries.seeker.askBody}</p>
              ) : null}

              {myInquiry ? (
                <div className="mt-3 space-y-2.5">
                  <div className="rounded-[var(--radius-control)] bg-bg p-3">
                    <p className="mb-1 text-2xs font-bold text-ink-soft">{t.inquiries.seeker.yourQuestion}</p>
                    <p className="text-sm leading-6 text-ink-soft">{myInquiry.message}</p>
                    <Badge tone={myInquiry.ownerReply ? 'openSoft' : 'neutral'} size="sm" className="mt-2">
                      {myInquiry.ownerReply ? t.inquiries.seeker.answered : t.inquiries.seeker.pending}
                    </Badge>
                  </div>
                  {myInquiry.ownerReply ? (
                    <div className="rounded-[var(--radius-control)] bg-ink p-3 text-on-ink motion-safe:animate-[fade-up_240ms_var(--ease-out)_both]">
                      <p className="mb-1 text-2xs font-bold text-on-ink-muted">{t.inquiries.seeker.ownerReply}</p>
                      <p className="text-sm leading-6">{myInquiry.ownerReply}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Button className="mt-3" onClick={() => setAskOpen(true)}>
                  <MessageCircleQuestion className="h-4 w-4" />
                  {t.inquiries.seeker.ask}
                </Button>
              )}

              <p className="mt-2.5 flex items-start gap-1.5 text-2xs leading-5 text-muted">
                <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t.inquiries.seeker.noContact}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {canApplyFromWatch ? (
        <section className="mt-5 flex flex-col gap-3 rounded-[var(--radius-card)] border border-ink p-4 motion-safe:animate-[fade-up_240ms_var(--ease-out)_both]">
          <h2 className="text-lg font-extrabold text-ink">{t.turnover.seeker.applyTitle}</h2>
          <p className="text-sm leading-6 text-ink-soft">
            {t.turnover.seeker.applyBody.replace('{date}', property.availability.date ? formatDate(property.availability.date) : t.availability.now)}
          </p>
          <Button
            size="lg"
            className="self-start max-sm:w-full"
            loading={applyFromWatch.isPending}
            onClick={() =>
              applyFromWatch.mutate(mine!.id, {
                onSuccess: () => pushToast(t.turnover.seeker.applied, 'success'),
                onError: onReserveError,
              })
            }
          >
            <Send className="h-4 w-4" />
            {t.turnover.seeker.apply}
          </Button>
        </section>
      ) : null}

      <section className="mt-5 rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle>{t.seeker.listing.queueTitle}</SectionTitle>

        {reserved && mine ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="openSoft" size="lg">
              <Check className="h-3.5 w-3.5" />
              {t.seeker.listing.reserved}
            </Badge>
            <Button
              variant="secondary"
              loading={leaveQueue.isPending}
              onClick={() =>
                leaveQueue.mutate(mine.id, { onSuccess: () => pushToast(t.seeker.queue.left) })
              }
            >
              {t.seeker.listing.leaveQueue}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="lg" loading={reserveQueue.isPending} onClick={() => onReserve(false)}>
              <Send className="h-4 w-4" />
              {t.seeker.listing.reserve}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              loading={watching ? leaveQueue.isPending : reserveQueue.isPending}
              onClick={() => {
                if (watching && mine) {
                  leaveQueue.mutate(mine.id, { onSuccess: () => pushToast(t.seeker.listing.unwatch) });
                  return;
                }
                onReserve(true);
              }}
            >
              {watching ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {watching ? t.seeker.listing.unwatch : t.seeker.listing.watch}
            </Button>
          </div>
        )}

        <p className="mt-2.5 text-2xs leading-5 text-muted">{t.seeker.listing.reserveHint}</p>
        <p className="mt-2 flex items-start gap-1.5 rounded-[var(--radius-control)] bg-surface p-2.5 text-2xs leading-5 text-muted">
          <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t.seeker.listing.contactHint}
        </p>
      </section>

      <section className="mt-5 rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle aside={reserved && seekerSlots.length ? <span className="text-2xs text-muted">{t.turnover.slots.live}</span> : null}>
          {myViewing
            ? changingViewing
              ? t.turnover.seeker.changeTitle
              : t.turnover.seeker.confirmedTitle
            : t.turnover.seeker.viewingsTitle}
        </SectionTitle>

        {viewing && viewing.eligible === false ? (
          <p className="rounded-[var(--radius-control)] bg-surface p-3 text-sm leading-6 text-ink-soft">
            {viewing.ineligibleReason}
          </p>
        ) : !reserved ? (
          <p className="text-sm text-muted">{t.seeker.listing.bookNeedQueue}</p>
        ) : myViewing && !changingViewing ? (
          <div className="flex flex-col gap-3">
            <p className="text-xl font-bold text-ink"><Num board>{formatDateTime(myViewing.startsAt)}</Num></p>
            <p className="text-sm text-ink-soft">{t.turnover.seeker.confirmedBody.replace('{label}', property.address.street)}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setChangingViewing(true)}>{t.turnover.seeker.change}</Button>
              <Button
                variant="quiet"
                loading={viewingAction.isPending}
                onClick={() =>
                  viewingAction.mutate(
                    { id: myViewing.id, action: 'cancel' },
                    { onSuccess: () => pushToast(t.turnover.seeker.cancelled, 'success') },
                  )
                }
              >
                {t.turnover.seeker.cancel}
              </Button>
            </div>
          </div>
        ) : seekerSlots.length === 0 ? (
          <EmptyState icon={Clock3} compact title={t.seeker.listing.viewingsEmpty} hint={t.seeker.listing.viewingsEmptyHint} />
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">
              {myViewing ? t.turnover.seeker.changeHint : t.turnover.seeker.viewingsHint}
            </p>
            <SlotGrid
              slots={seekerSlots.map((slot) => ({
                id: slot.id,
                startsAt: slot.startsAt,
                state: slot.mine ? 'mine' : slot.taken ? 'taken' : 'open',
              }))}
              pendingId={viewingAction.isPending ? (viewingAction.variables?.id ?? null) : null}
              onPick={(slotId) => {
                if (!mine) return;
                /* Moving to another time: give the current one back first. */
                const swap = myViewing
                  ? new Promise<void>((resolve) =>
                      viewingAction.mutate({ id: myViewing.id, action: 'cancel' }, { onSettled: () => resolve() }),
                    )
                  : Promise.resolve();
                void swap.then(() =>
                  viewingAction.mutate(
                    { id: slotId, action: 'book', body: { leadId: mine.id } },
                    {
                      onSuccess: () => {
                        setChangingViewing(false);
                        pushToast(t.seeker.listing.booked, 'success');
                      },
                      onError: () => {
                        pushToast(t.turnover.slots.gone, 'alert');
                        /* Taken in the meantime: put them back in the time they had. */
                        if (myViewing) viewingAction.mutate({ id: myViewing.id, action: 'book', body: { leadId: mine.id } });
                      },
                    },
                  ),
                );
              }}
            />
            {myViewing ? (
              <Button variant="quiet" className="mt-3" onClick={() => setChangingViewing(false)}>
                {t.turnover.seeker.keep}
              </Button>
            ) : null}
          </>
        )}
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <SectionTitle>{t.seeker.listing.costs}</SectionTitle>
          <dl className="space-y-2 text-sm">
            <Line label={t.seeker.listing.rent} value={<Money agorot={property.monthlyRentAgorot} board />} />
            <Line
              label={t.seeker.listing.arnona}
              value={<Money agorot={property.arnonaBimonthlyAgorot} board />}
            />
            <Line label={t.seeker.listing.vaad} value={<Money agorot={property.vaadMonthlyAgorot} board />} />
            <div className="border-t border-line pt-2">
              <Line
                label={t.seeker.listing.totalMonthly}
                strong
                value={<Money agorot={totalMonthlyAgorot} board />}
              />
            </div>
          </dl>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <SectionTitle>{t.seeker.listing.amenities}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {property.amenities.map((a) => (
              <Badge key={a} tone="outline" size="sm">
                {amenityLabel(a)}
              </Badge>
            ))}
          </div>
          <SectionTitle className="mb-2 mt-4">{t.seeker.listing.floorPlan}</SectionTitle>
          <div className="grid h-28 place-items-center rounded-[var(--radius-control)] border border-dashed border-line text-2xs text-muted">
            {t.seeker.listing.floorPlanMock}
          </div>
        </section>
      </div>

      <OfferRail placement="queue" audience="seeker" className="mt-6" />

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.inquiries.seeker.askTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label={t.inquiries.seeker.moveInLabel} htmlFor="ask-date">
              <Input
                id="ask-date"
                type="date"
                dir="ltr"
                className="num"
                value={askDate || (property.availability.date ?? '')}
                onChange={(e) => setAskDate(e.target.value)}
              />
            </Field>
            <Field label={t.inquiries.seeker.messageLabel} htmlFor="ask-text">
              <Textarea
                id="ask-text"
                value={askText}
                onChange={(e) => setAskText(e.target.value)}
                placeholder={t.inquiries.seeker.messagePlaceholder}
                className="min-h-28"
              />
            </Field>
            <p className="flex items-start gap-1.5 rounded-[var(--radius-control)] bg-surface p-2.5 text-2xs leading-5 text-muted">
              <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t.inquiries.seeker.noContact}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              disabled={!askText.trim()}
              loading={askAvailability.isPending}
              onClick={() => {
                askAvailability.mutate(
                  {
                    propertyId: property.id,
                    message: askText.trim(),
                    desiredMoveIn: askDate || property.availability.date || todayIso(),
                  },
                  {
                    onSuccess: () => {
                      setAskOpen(false);
                      setAskText('');
                      pushToast(t.inquiries.seeker.sent, 'success');
                    },
                  },
                );
              }}
            >
              {t.inquiries.seeker.send}
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">{t.ui.cancel}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={profileGateOpen} onOpenChange={setProfileGateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.seeker.listing.profileNeeded}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
              <Users className="mt-1 h-4 w-4 shrink-0 text-muted" />
              {t.seeker.listing.profileNeededHint}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => navigate('/search/profile')}>{t.seeker.listing.completeProfile}</Button>
            <DialogClose asChild>
              <Button variant="secondary">{t.ui.cancel}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn('text-sm', strong ? 'font-bold text-ink' : 'font-semibold text-ink-soft')}>{value}</dd>
    </div>
  );
}
