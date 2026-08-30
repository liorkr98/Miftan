import * as React from 'react';
import { useStore, useStoreShallow } from '@/data/store';
import { t, formatMoney, type AffiliateOffer } from '@miftan/shared';
import { cn } from '@/lib/utils';
import { Money, Num } from './typography';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BadgeCheck, Banknote, Check, Info, X } from 'lucide-react';

/**
 * The revenue lens.
 *
 * Toggling it marks every point in the running product where the platform
 * earns, with the stream and the amount. It is a demo affordance, not a user
 * feature — which is exactly why it beats a slide: you turn it on mid-flow and
 * the app itself shows where the money is.
 */
export function RevenueMarker({
  streamId,
  className,
  note,
}: {
  streamId: string;
  className?: string;
  note?: string;
}) {
  const lens = useStore((s) => s.revenueLens);
  const stream = useStore((s) => s.revenueStreams.find((x) => x.id === streamId));

  if (!lens || !stream) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-dashed border-signal bg-signal-soft px-2 py-0.5 text-2xs font-bold text-signal-deep',
        'motion-safe:animate-[fade-up_220ms_var(--ease-out)_both]',
        className,
      )}
      title={stream.basis}
    >
      <Banknote className="h-3 w-3" />
      <span>{note ?? stream.name}</span>
      <Money value={stream.unit_revenue} board className="font-bold" />
      <span className="font-medium opacity-70">{t.revenue.perEvent}</span>
    </span>
  );
}

/** Wraps a region so the whole thing outlines when the lens is on. */
export function RevenueZone({
  streamId,
  children,
  className,
}: {
  streamId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const lens = useStore((s) => s.revenueLens);
  return (
    <div
      className={cn(
        'transition-[box-shadow,background-color] duration-200 ease-[var(--ease-out)]',
        lens && 'rounded-[var(--radius-card)] bg-signal-soft/40 shadow-[0_0_0_2px_var(--color-signal)]',
        className,
      )}
    >
      {children}
      {lens ? (
        <div className="px-3 pb-2 pt-1">
          <RevenueMarker streamId={streamId} />
        </div>
      ) : null}
    </div>
  );
}

/* ── Affiliate offer card ──────────────────────────────── */

export function OfferCard({
  offer,
  className,
}: {
  offer: AffiliateOffer;
  className?: string;
}) {
  const requestOffer = useStore((s) => s.requestOffer);
  const pushToast = useStore((s) => s.pushToast);
  const requested = useStore((s) => s.offerRequests.includes(offer.id));
  const lens = useStore((s) => s.revenueLens);
  const [dismissed, setDismissed] = React.useState(false);
  const [showWhy, setShowWhy] = React.useState(false);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border p-3.5 transition-[box-shadow,border-color] duration-200 ease-[var(--ease-out)]',
        lens ? 'border-signal shadow-[0_0_0_2px_var(--color-signal)]' : 'border-line',
        className,
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink">{offer.title}</h3>
          <p className="text-2xs text-muted">{offer.provider}</p>
        </div>
        <Badge tone="signalSoft" size="sm">
          <BadgeCheck className="h-3 w-3" />
          {t.offers.partnerLabel}
        </Badge>
      </div>

      <p className="text-xs leading-5 text-ink-soft">{offer.pitch}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-ink">
          {t.offers.from} <Money value={offer.price_from} board />
        </span>
        <span className="text-2xs text-muted">{offer.price_unit}</span>

        <div className="ms-auto flex items-center gap-1.5">
          {requested ? (
            <Badge tone="openSoft" size="md">
              <Check className="h-3 w-3" strokeWidth={3} />
              {t.offers.requested}
            </Badge>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => {
                  requestOffer(offer.id);
                  pushToast(t.offers.requestedHint, 'success');
                }}
              >
                {offer.cta}
              </Button>
              <Button
                size="iconSm"
                variant="ghost"
                aria-label={t.offers.dismiss}
                onClick={() => setDismissed(true)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {lens ? (
        <div className="mt-2.5 border-t border-signal/40 pt-2.5">
          <RevenueMarker
            streamId={offer.stream_id}
            note={`${t.offers.platformEarns} · ${formatMoney(offer.platform_revenue)}`}
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setShowWhy((v) => !v)}
        className="mt-2 flex items-center gap-1 text-2xs text-muted underline-offset-2 hover:text-ink hover:underline"
      >
        <Info className="h-3 w-3" />
        {t.offers.whyHere}
      </button>
      {showWhy ? (
        <p className="mt-1 text-2xs leading-4 text-muted motion-safe:animate-[fade-up_200ms_var(--ease-out)_both]">
          {offer.disclosure}
        </p>
      ) : null}
    </div>
  );
}

/** All offers for a given placement, with the section heading. */
export function OfferRail({
  placement,
  audience,
  title,
  className,
}: {
  placement: AffiliateOffer['placement'];
  audience?: AffiliateOffer['audience'];
  title?: string;
  className?: string;
}) {
  const affiliateOffers = useStore((s) => s.affiliateOffers);
  const offers = affiliateOffers.filter(
    (o) => o.placement === placement && (!audience || o.audience === audience),
  );

  if (offers.length === 0) return null;

  const heading =
    title ??
    (audience === 'tenant'
      ? t.offers.sectionTenant
      : audience === 'seeker'
        ? t.offers.sectionSeeker
        : t.offers.sectionOwner);

  return (
    <section className={className}>
      <h2 className="mb-2.5 text-sm font-bold text-ink">{heading}</h2>
      <div className="stagger grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    </section>
  );
}

/* ── Projection maths, shared by the lens and the model page ── */

/**
 * Derive in a memo, not in the selector. A zustand selector that builds fresh
 * objects fails shallow comparison on every store read and re-renders forever;
 * the selector must return stable references and the maths happens after.
 */
export function useRevenueModel() {
  const { streams, units } = useStoreShallow((s) => ({
    streams: s.revenueStreams,
    units: s.properties.length,
  }));

  return React.useMemo(() => {
    const rows = streams
      .filter((x) => x.active)
      .map((stream) => {
        const perUnitYear = stream.unit_revenue * stream.events_per_unit_year;
        return { stream, perUnitYear, annual: perUnitYear * units };
      })
      .sort((a, b) => b.annual - a.annual);

    return {
      units,
      rows,
      excluded: streams.filter((x) => !x.active),
      perUnitYear: rows.reduce((sum, r) => sum + r.perUnitYear, 0),
      annual: rows.reduce((sum, r) => sum + r.annual, 0),
    };
  }, [streams, units]);
}

/** A compact "this is where money happens" counter for the top bar. */
export function RevenueLensToggle() {
  const lens = useStore((s) => s.revenueLens);
  const toggle = useStore((s) => s.toggleRevenueLens);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={lens}
      title={t.revenue.lensHint}
      className={cn(
        'press flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs font-semibold',
        'transition-[background-color,color,transform] duration-[var(--dur-press)] ease-[var(--ease-out)]',
        lens
          ? 'bg-signal text-ink'
          : 'text-on-ink-muted hover:bg-white/10 hover:text-on-ink',
      )}
    >
      <Banknote className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">{t.revenue.lens}</span>
    </button>
  );
}

export { Num };
