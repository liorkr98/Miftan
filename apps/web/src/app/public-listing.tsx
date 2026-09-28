import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  APP_NAME,
  formatFloor,
  formatRooms,
  formatSqm,
  t,
} from '@miftan/shared';
import { useProperty } from '@/api/hooks';
import { useAuth } from '@/api/auth';
import { Wordmark } from '@/components/shared/wordmark';
import { AvailabilityChip } from '@/components/shared/status';
import { Money } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPinX, Share2 } from 'lucide-react';

type Amenity = keyof typeof t.amenity;

/**
 * A listing anyone can open — the link an owner or agent drops into a
 * WhatsApp group or a Facebook post.
 *
 * It shows what the public projection allows and nothing else: the street
 * (not the house number unless the owner chose to show it), the terms and
 * the photos. Getting in touch needs an account, which is the door into the
 * product for the person reading it. The preview card WhatsApp shows for this
 * link is written server-side by the web Worker (worker/index.ts), because
 * WhatsApp never runs this page's JavaScript.
 */
export function PublicListing() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data: property, isLoading, isError, error } = useProperty(id);
  const [photo, setPhoto] = React.useState(0);

  React.useEffect(() => {
    if (!property) return;
    document.title = `${t.publicListing.title
      .replace('{rooms}', formatRooms(property.rooms))
      .replace('{street}', property.address.street)
      .replace('{city}', property.address.city)} · ${APP_NAME}`;
  }, [property]);

  const listingPath = `/search/${id}`;

  const header = (
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <Link to="/" aria-label={APP_NAME}>
          <Wordmark size="sm" />
        </Link>
        {user ? null : (
          <Link to="/sign-in" state={{ from: listingPath }} className="text-xs font-semibold text-ink-soft hover:text-ink">
            {t.auth.title}
          </Link>
        )}
      </div>
    </header>
  );

  if (isError && error instanceof ApiError && error.code === 'not_found') {
    return (
      <div className="min-h-dvh bg-surface">
        {header}
        <div className="mx-auto max-w-3xl px-4 py-10">
          <EmptyState icon={MapPinX} title={t.seeker.listing.notFound} hint={t.seeker.listing.notFoundHint} />
        </div>
      </div>
    );
  }
  if (isLoading || !property) {
    return (
      <div className="min-h-dvh bg-surface">
        {header}
        <div className="mx-auto max-w-4xl px-4 py-6">
          <ListSkeleton rows={6} />
        </div>
      </div>
    );
  }

  const a = property.address;
  const place = [a.number ? `${a.street} ${a.number}` : a.street, a.neighborhood, a.city].filter(Boolean).join(', ');
  const totalMonthly =
    property.monthlyRentAgorot + Math.round(property.arnonaBimonthlyAgorot / 2) + property.vaadMonthlyAgorot;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* Cancelled, or clipboard refused: the address bar still has the link. */
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      {header}
      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-bg">
          {property.photos[photo] ? (
            <img src={property.photos[photo]} alt="" className="aspect-[16/9] w-full object-cover" />
          ) : null}
          {property.photos.length > 1 ? (
            <div className="hide-scrollbar flex gap-1.5 overflow-x-auto bg-surface p-2">
              {property.photos.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`${t.unit.photos} ${i + 1}`}
                  aria-pressed={photo === i}
                  className="press-sm shrink-0 overflow-hidden rounded-[8px] aria-pressed:ring-2 aria-pressed:ring-ink"
                >
                  <img src={src} alt="" loading="lazy" className="h-14 w-20 object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-extrabold leading-8 text-ink">
                  {t.publicListing.heading.replace('{rooms}', formatRooms(property.rooms)).replace('{street}', a.street)}
                </h1>
                <p className="mt-1 text-sm text-ink-soft">{place}</p>
              </div>
              <div className="text-end">
                <Money agorot={property.monthlyRentAgorot} board className="text-2xl font-extrabold text-ink" />
                <p className="text-2xs text-muted">{t.publicListing.perMonth}</p>
              </div>
            </div>

            <AvailabilityChip
              kind={property.availability.kind}
              date={property.availability.date ?? undefined}
              confidence={property.availability.confidence}
              size="lg"
            />

            <dl className="grid grid-cols-3 gap-3 rounded-[var(--radius-card)] bg-surface p-4 text-center">
              <Fact label={t.properties.rooms} value={formatRooms(property.rooms)} />
              <Fact label={t.properties.sqm} value={formatSqm(property.sqm)} />
              <Fact label={t.properties.floor} value={formatFloor(property.floor, property.totalFloors)} />
            </dl>

            {property.amenities.length ? (
              <div>
                <h2 className="mb-2 text-sm font-bold text-ink">{t.unit.amenities}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {property.amenities.map((key) => (
                    <Badge key={key} tone="outline" size="sm">
                      {key in t.amenity ? t.amenity[key as Amenity] : key}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-4 text-sm">
              <span className="text-ink-soft">{t.seeker.listing.totalMonthly}</span>
              <Money agorot={totalMonthly} board className="font-bold text-ink" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg">
                {user ? (
                  <Link to={listingPath}>{t.publicListing.contact}</Link>
                ) : (
                  <Link to="/sign-up" state={{ from: listingPath }}>
                    {t.publicListing.contact}
                  </Link>
                )}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => void share()}>
                <Share2 className="h-4 w-4" />
                {t.publicListing.share}
              </Button>
            </div>
            {user ? null : <p className="text-2xs leading-5 text-muted">{t.publicListing.contactHint}</p>}
          </div>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-2xs text-muted">
          <Link to="/" className="hover:text-ink">
            {t.publicListing.builtWith.replace('{app}', APP_NAME)}
          </Link>
          <Link to="/legal/terms" className="hover:text-ink">{t.publicListing.terms}</Link>
          <Link to="/legal/privacy" className="hover:text-ink">{t.publicListing.privacy}</Link>
          <Link to="/legal/accessibility" className="hover:text-ink">{t.publicListing.accessibility}</Link>
        </footer>
      </main>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs text-muted">{label}</dt>
      <dd className="num mt-0.5 text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}
