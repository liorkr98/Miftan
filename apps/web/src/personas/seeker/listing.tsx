import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t, formatFloor, formatRooms, formatSqm, formatUntil, formatDate, type TrackRow } from '@miftan/shared';
import { availabilityKind, leaseForProperty } from '@/data/selectors';
import { DepartureTrack } from '@/components/shared/departure-track';
import { AvailabilityChip } from '@/components/shared/status';
import { Money, Num, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
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

export function SeekerListing() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { properties, leases, leads, seekers, inquiries, currentSeekerId } = useStoreShallow((s) => ({
    properties: s.properties,
    leases: s.leases,
    leads: s.leads,
    seekers: s.seekers,
    inquiries: s.inquiries,
    currentSeekerId: s.currentSeekerId,
  }));
  const reserveQueue = useStore((s) => s.reserveQueue);
  const askAvailability = useStore((s) => s.askAvailability);
  const leaveQueue = useStore((s) => s.leaveQueue);
  const toggleWatch = useStore((s) => s.toggleWatch);
  const pushToast = useStore((s) => s.pushToast);

  const [photoIndex, setPhotoIndex] = React.useState(0);
  const [profileGateOpen, setProfileGateOpen] = React.useState(false);
  const [askOpen, setAskOpen] = React.useState(false);
  const [askText, setAskText] = React.useState('');
  const [askDate, setAskDate] = React.useState('');

  const property = properties.find((p) => p.id === id);
  const seeker = seekers.find((x) => x.id === currentSeekerId);

  if (!property) {
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

  const lease = leaseForProperty(leases, property.id);
  const kind = availabilityKind(property, lease);
  const queue = leads
    .filter((l) => l.property_id === property.id && !l.watch_only)
    .sort((a, b) => a.queue_position - b.queue_position);
  const mine = leads.find((l) => l.property_id === property.id && l.seeker_id === currentSeekerId);
  const watching = Boolean(mine?.watch_only);
  const reserved = Boolean(mine && !mine.watch_only);

  /* No publishable date and the tenant hasn't said they're staying — this is
     exactly the apartment the market currently hides. */
  const undecided = kind === 'unknown' || kind === 'extending';
  const myInquiry = inquiries.find(
    (x) => x.property_id === property.id && x.seeker_id === currentSeekerId,
  );

  const totalMonthly =
    property.monthly_rent + Math.round(property.arnona_bimonthly / 2) + property.vaad_monthly;

  const similar = properties
    .filter(
      (p) =>
        p.id !== property.id &&
        p.listed &&
        p.address.neighborhood === property.address.neighborhood,
    )
    .slice(0, 3);

  /* The same track, showing this unit's availability and the queue on it. */
  const trackRows: TrackRow[] = [
    {
      id: property.id,
      property_id: property.id,
      label: `${property.address.street} ${property.address.number}`,
      sublabel: property.address.neighborhood,
      from: new Date().toISOString().slice(0, 10),
      until: property.status === 'vacant' ? undefined : property.available_from,
      tone: kind === 'now' ? 'open' : kind === 'dated' ? 'signal' : kind === 'extending' ? 'live' : 'muted',
      confidence: property.availability_confidence,
      marks: property.available_from
        ? queue.slice(0, 6).map((lead) => ({
            at: property.available_from!,
            kind: 'queue' as const,
            label: `${t.seeker.listing.yourPosition} ${lead.queue_position}`,
          }))
        : [],
    },
  ];

  const onReserve = () => {
    if (!seeker?.profile_complete) {
      setProfileGateOpen(true);
      return;
    }
    reserveQueue(property.id);
    pushToast(t.seeker.listing.reserved, 'success');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
      <Button variant="quiet" size="sm" className="-ms-2 mb-2" onClick={() => navigate('/search')}>
        <ArrowRight className="h-3.5 w-3.5" />
        {t.seeker.listing.backToSearch}
      </Button>

      {/* Photos */}
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line">
        <img
          src={property.photos[photoIndex]}
          alt=""
          className="aspect-[16/9] w-full object-cover"
        />
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

      {/* Header */}
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
            {formatFloor(property.floor, property.total_floors)}
          </p>
        </div>
        <div className="text-end">
          <Money value={property.monthly_rent} board className="text-2xl font-bold text-ink" />
          <p className="text-2xs text-muted">{t.ui.perMonth}</p>
        </div>
      </header>

      <div className="mt-3">
        <AvailabilityChip kind={kind} date={property.available_from}
              confidence={property.availability_confidence} size="lg" withCountdown />
      </div>

      {/* Availability timeline — the same component as the owner's board */}
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

      {/* ── Undecided units: ask the owner ────────────────
          The apartment has no publishable date because the tenant hasn't
          decided. Rather than hide it, we let the seeker start the chain
          that produces a date — without ever reaching the tenant. */}
      {undecided || myInquiry ? (
        <section
          className={cn(
            'mt-5 rounded-[var(--radius-card)] border p-4',
            myInquiry?.owner_reply ? 'border-line bg-surface' : 'border-live/40 bg-live-soft',
          )}
        >
          <div className="flex items-start gap-2.5">
            <Clock3
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                myInquiry?.owner_reply ? 'text-muted' : 'text-live',
              )}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink">
                {myInquiry?.owner_reply ? t.inquiries.seeker.answered : t.availability.askable}
              </h2>
              {!myInquiry?.owner_reply ? (
                <p className="mt-1 text-xs leading-5 text-ink-soft">{t.inquiries.seeker.askBody}</p>
              ) : null}

              {myInquiry ? (
                <div className="mt-3 space-y-2.5">
                  <div className="rounded-[var(--radius-control)] bg-bg p-3">
                    <p className="mb-1 text-2xs font-bold text-ink-soft">
                      {t.inquiries.seeker.yourQuestion}
                    </p>
                    <p className="text-sm leading-6 text-ink-soft">{myInquiry.message}</p>
                    <Badge
                      tone={myInquiry.owner_reply ? 'openSoft' : 'neutral'}
                      size="sm"
                      className="mt-2"
                    >
                      {myInquiry.owner_reply
                        ? t.inquiries.seeker.answered
                        : t.inquiries.seeker.pending}
                    </Badge>
                  </div>
                  {myInquiry.owner_reply ? (
                    <div className="rounded-[var(--radius-control)] bg-ink p-3 text-on-ink motion-safe:animate-[fade-up_240ms_var(--ease-out)_both]">
                      <p className="mb-1 text-2xs font-bold text-on-ink-muted">
                        {t.inquiries.seeker.ownerReply}
                      </p>
                      <p className="text-sm leading-6">{myInquiry.owner_reply}</p>
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

      {/* Queue + primary action */}
      <section className="mt-5 rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle
          aside={
            queue.length ? (
              <span className="text-2xs text-muted">
                <Num board className="font-bold text-ink">
                  {queue.length}
                </Num>{' '}
                {t.seeker.listing.queueCount}
              </span>
            ) : null
          }
        >
          {t.seeker.listing.queueTitle}
        </SectionTitle>

        {queue.length === 0 ? (
          <p className="text-xs text-muted">
            {t.seeker.listing.queueEmpty} — {t.seeker.listing.queueEmptyHint}
          </p>
        ) : (
          <ol className="mb-3 flex flex-wrap gap-1.5">
            {queue.slice(0, 12).map((lead) => {
              const isMine = lead.seeker_id === currentSeekerId;
              return (
                <li
                  key={lead.id}
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-full text-2xs font-bold',
                    isMine ? 'bg-ink text-on-ink' : 'bg-surface-sunk text-muted',
                  )}
                  title={isMine ? t.seeker.listing.yourPosition : t.seeker.search.inQueue}
                >
                  <Num board>{lead.queue_position}</Num>
                </li>
              );
            })}
          </ol>
        )}

        {reserved && mine ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="openSoft" size="lg">
              {t.seeker.listing.yourPosition}: <Num board>{mine.queue_position}</Num>
            </Badge>
            <Button
              variant="secondary"
              onClick={() => {
                leaveQueue(mine.id);
                pushToast(t.seeker.queue.left);
              }}
            >
              {t.seeker.listing.leaveQueue}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={onReserve}>
              <Ticket className="h-4 w-4" />
              {t.seeker.listing.reserve}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                toggleWatch(property.id);
                pushToast(watching ? t.seeker.listing.unwatch : t.seeker.listing.watching, 'success');
              }}
            >
              {watching ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {watching ? t.seeker.listing.unwatch : t.seeker.listing.watch}
            </Button>
          </div>
        )}

        <p className="mt-2.5 text-2xs leading-5 text-muted">{t.seeker.listing.reserveHint}</p>

        {/* The privacy rule, stated on the surface where it matters */}
        <p className="mt-2 flex items-start gap-1.5 rounded-[var(--radius-control)] bg-surface p-2.5 text-2xs leading-5 text-muted">
          <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t.seeker.listing.contactHint}
        </p>
      </section>

      {/* Costs + amenities */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <SectionTitle>{t.seeker.listing.costs}</SectionTitle>
          <dl className="space-y-2 text-sm">
            <Line label={t.seeker.listing.rent} value={<Money value={property.monthly_rent} board />} />
            <Line label={t.seeker.listing.arnona} value={<Money value={property.arnona_bimonthly} board />} />
            <Line label={t.seeker.listing.vaad} value={<Money value={property.vaad_monthly} board />} />
            <div className="border-t border-line pt-2">
              <Line
                label={t.seeker.listing.totalMonthly}
                strong
                value={<Money value={totalMonthly} board />}
              />
            </div>
          </dl>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <SectionTitle>{t.seeker.listing.amenities}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {property.amenities.map((a) => (
              <Badge key={a} tone="outline" size="sm">
                {t.amenity[a]}
              </Badge>
            ))}
          </div>

          <SectionTitle className="mb-2 mt-4">{t.seeker.listing.floorPlan}</SectionTitle>
          <div className="grid h-28 place-items-center rounded-[var(--radius-control)] border border-dashed border-line text-2xs text-muted">
            {t.seeker.listing.floorPlanMock}
          </div>
        </section>
      </div>

      {/* Similar */}
      {similar.length ? (
        <section className="mt-5">
          <SectionTitle>{t.seeker.listing.similarUnits}</SectionTitle>
          <ul className="grid gap-2.5 sm:grid-cols-3">
            {similar.map((p) => {
              const k = availabilityKind(p, leaseForProperty(leases, p.id));
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoIndex(0);
                      navigate(`/search/${p.id}`);
                    }}
                    className="w-full overflow-hidden rounded-[var(--radius-card)] border border-line text-start transition-colors duration-150 hover:border-line-strong"
                  >
                    <img src={p.photos[0]} alt="" loading="lazy" className="h-24 w-full object-cover" />
                    <span className="block p-2.5">
                      <span className="block truncate text-xs font-bold text-ink">
                        {p.address.street} {p.address.number}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <Money value={p.monthly_rent} board className="text-xs font-bold text-ink" />
                        <span className="text-2xs text-muted">
                          {p.available_from ? formatUntil(p.available_from) : t.availability.now}
                        </span>
                      </span>
                      <span className="mt-1.5 block">
                        <AvailabilityChip kind={k} date={p.available_from}
              confidence={p.availability_confidence} size="sm" />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <OfferRail placement="queue" audience="seeker" className="mt-6" />

      {/* Ask the owner about an undecided unit */}
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
                value={askDate || (property.available_from ?? '')}
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
              onClick={() => {
                askAvailability(
                  property.id,
                  askText.trim(),
                  askDate || property.available_from || formatDate(new Date()),
                );
                setAskOpen(false);
                setAskText('');
                pushToast(t.inquiries.seeker.sent, 'success');
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

      {/* Profile gate */}
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
            <Button onClick={() => navigate('/search/profile')}>
              {t.seeker.listing.completeProfile}
            </Button>
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
      <dd className={cn('text-sm', strong ? 'font-bold text-ink' : 'font-semibold text-ink-soft')}>
        {value}
      </dd>
    </div>
  );
}
