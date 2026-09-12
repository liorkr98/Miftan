import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '@/data/store';
import {
  ApiError,
  t,
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
  useAskAvailability,
  useInquiries,
  useLeads,
  useLeaveQueue,
  useProperty,
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
  Clock3,
  EyeOff,
  MapPinX,
  MessageCircleQuestion,
  Ticket,
  Users,
} from 'lucide-react';
import { Field, Input, Textarea } from '@/components/ui/field';
import { OfferRail } from '@/components/shared/revenue';

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
  const { data: leads = [] } = useLeads();
  const { data: inquiries = [] } = useInquiries();
  const { data: viewing } = useViewings(id);
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
      marks: property.availability.date
        ? [
            {
              at: property.availability.date,
              kind: 'queue' as const,
              label: reserved && mine
                ? `${t.seeker.listing.yourPosition} ${mine.queuePosition}`
                : t.seeker.search.inQueue,
            },
          ]
        : [],
    },
  ];

  const seekerSlots = (viewing?.slots ?? []).filter((s): s is SeekerSlot => s.scope === 'seeker');
  const queueLength = mine?.queueLength ?? property.queueCount;

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

      <section className="mt-5 rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle
          aside={
            queueLength ? (
              <span className="text-2xs text-muted">
                <Num board className="font-bold text-ink">
                  {queueLength}
                </Num>{' '}
                {t.seeker.listing.queueCount}
              </span>
            ) : null
          }
        >
          {t.seeker.listing.queueTitle}
        </SectionTitle>

        {queueLength === 0 ? (
          <p className="text-xs text-muted">
            {t.seeker.listing.queueEmpty} — {t.seeker.listing.queueEmptyHint}
          </p>
        ) : (
          <ol className="mb-3 flex flex-wrap gap-1.5">
            {Array.from({ length: Math.min(queueLength, 12) }, (_, i) => i + 1).map((position) => {
              const isMine = Boolean(reserved && mine && mine.queuePosition === position);
              return (
                <li
                  key={position}
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-full text-2xs font-bold',
                    isMine ? 'bg-ink text-on-ink' : 'bg-surface-sunk text-muted',
                  )}
                  title={isMine ? t.seeker.listing.yourPosition : t.seeker.search.inQueue}
                >
                  <Num board>{position}</Num>
                </li>
              );
            })}
          </ol>
        )}

        {reserved && mine ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="openSoft" size="lg">
              {t.seeker.listing.yourPosition}: <Num board>{mine.queuePosition}</Num>
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
              <Ticket className="h-4 w-4" />
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
        <SectionTitle>{t.seeker.listing.viewings}</SectionTitle>
        <p className="mb-3 text-xs text-muted">{t.seeker.listing.viewingsHint}</p>

        {viewing && viewing.eligible === false ? (
          <p className="rounded-[var(--radius-control)] bg-surface p-3 text-xs leading-5 text-ink-soft">
            {viewing.ineligibleReason}
          </p>
        ) : !reserved ? (
          <p className="text-xs text-muted">{t.seeker.listing.bookNeedQueue}</p>
        ) : seekerSlots.length === 0 ? (
          <EmptyState
            icon={Clock3}
            compact
            title={t.seeker.listing.viewingsEmpty}
            hint={t.seeker.listing.viewingsEmptyHint}
          />
        ) : (
          <ul className="space-y-2">
            {seekerSlots.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2"
              >
                <span className="text-sm font-semibold text-ink">
                  <Num board>{formatDateTime(slot.startsAt)}</Num>
                </span>
                {slot.mine ? (
                  <span className="flex items-center gap-2">
                    <Badge tone="openSoft" size="sm">
                      {t.seeker.listing.slotMine}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={viewingAction.isPending}
                      onClick={() =>
                        viewingAction.mutate(
                          { id: slot.id, action: 'cancel' },
                          { onSuccess: () => pushToast(t.seeker.listing.cancelled, 'success') },
                        )
                      }
                    >
                      {t.seeker.listing.cancelSlot}
                    </Button>
                  </span>
                ) : slot.taken ? (
                  <Badge tone="neutral" size="sm">
                    {t.seeker.listing.slotTaken}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    loading={viewingAction.isPending}
                    disabled={!mine}
                    onClick={() => {
                      if (!mine) return;
                      viewingAction.mutate(
                        { id: slot.id, action: 'book', body: { leadId: mine.id } },
                        { onSuccess: () => pushToast(t.seeker.listing.booked, 'success') },
                      );
                    }}
                  >
                    {t.seeker.listing.bookSlot}
                  </Button>
                )}
              </li>
            ))}
          </ul>
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
