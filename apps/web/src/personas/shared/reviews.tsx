import * as React from 'react';
import { t, formatDate } from '@miftan/shared';
import { useReviews, useWriteReview } from '@/api/hooks';
import { useStore } from '@/data/store';
import { Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Textarea } from '@/components/ui/field';
import { Star } from 'lucide-react';

export function ReviewsPage() {
  const { data, isLoading, isError, refetch } = useReviews();
  const write = useWriteReview();
  const pushToast = useStore((s) => s.pushToast);
  const [openLease, setOpenLease] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState(5);
  const [body, setBody] = React.useState('');

  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading || !data) return <ListSkeleton rows={6} />;

  const submit = (leaseId: string) => {
    write.mutate(
      { leaseId, rating, body: body.trim() },
      {
        onSuccess: () => {
          pushToast(t.reviews.sent, 'success');
          setOpenLease(null);
          setBody('');
          setRating(5);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.reviews.title}
        subtitle={t.reviews.subtitle}
        actions={
          data.averageRating != null ? (
            <span className="text-xs text-muted">
              {t.reviews.average}{' '}
              <Num board className="font-bold text-ink">
                {data.averageRating.toFixed(1)}
              </Num>
              {' · '}
              <Num board>{data.reviewCount}</Num> {t.reviews.count}
            </span>
          ) : null
        }
      />

      <section className="space-y-3">
        <SectionTitle>{t.reviews.pending}</SectionTitle>
        {data.pending.length === 0 ? (
          <EmptyState title={t.reviews.emptyPending} compact />
        ) : (
          <ul className="space-y-3">
            {data.pending.map((p) => (
              <li key={p.leaseId} className="rounded-[var(--radius-card)] border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink">{p.propertyLabel}</p>
                    <p className="text-2xs text-muted">
                      {t.reviews.writeFor} {p.counterpartName} · {formatDate(p.tenancyFrom)}–{formatDate(p.tenancyUntil)}
                    </p>
                    <p className="mt-1 text-2xs text-muted">
                      {t.reviews.writeBy} {formatDate(p.writeBy)} ·{' '}
                      {p.myRole === 'owner' ? t.reviews.roleOwner : t.reviews.roleTenant}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setOpenLease(p.leaseId)}>
                    {t.reviews.write}
                  </Button>
                </div>
                {openLease === p.leaseId ? (
                  <div className="mt-4 space-y-3 border-t border-line pt-4">
                    <div className="flex gap-1" role="radiogroup" aria-label={t.reviews.rating}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRating(n)}
                          aria-pressed={rating === n}
                          className="press-sm grid h-8 w-8 place-items-center rounded-[var(--radius-control)] border border-line text-xs font-bold"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <Field label={t.reviews.body} hint={t.reviews.bodyHint} htmlFor={`rev-${p.leaseId}`}>
                      <Textarea
                        id={`rev-${p.leaseId}`}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                      />
                    </Field>
                    <Button
                      onClick={() => submit(p.leaseId)}
                      loading={write.isPending}
                      disabled={body.trim().length < 20}
                    >
                      {t.reviews.send}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>{t.reviews.yours}</SectionTitle>
        {data.mine.length === 0 ? (
          <EmptyState title={t.reviews.emptyMine} compact />
        ) : (
          <ul className="space-y-3">
            {data.mine.map((r) => (
              <li key={r.id} className="rounded-[var(--radius-card)] border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{r.propertyLabel}</p>
                  <Badge tone={r.published ? 'openSoft' : 'signalSoft'} size="sm">
                    {r.published
                      ? t.reviews.published
                      : `${t.reviews.sealed} ${r.sealedUntil ? formatDate(r.sealedUntil) : ''}`}
                  </Badge>
                </div>
                <p className="mt-1 text-2xs text-muted">
                  {t.reviews.rating} {r.rating}/5
                </p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>{t.reviews.aboutYou}</SectionTitle>
        {data.about.length === 0 ? (
          <EmptyState icon={Star} title={t.reviews.emptyAbout} hint={t.reviews.emptyAboutHint} compact />
        ) : (
          <ul className="space-y-3">
            {data.about.map((r) => (
              <li key={r.id} className="rounded-[var(--radius-card)] border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{r.propertyLabel}</p>
                  <span className="text-2xs text-muted">
                    {r.rating}/5 · {formatDate(r.publishedAt)}
                  </span>
                </div>
                <p className="mt-1 text-2xs text-muted">
                  {r.authorName} · {r.authorRole === 'owner' ? t.reviews.roleOwner : t.reviews.roleTenant}
                </p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
