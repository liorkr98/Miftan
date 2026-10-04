import { t } from '@miftan/shared';
import { Bell, Eye } from 'lucide-react';
import { Num } from '@/components/shared/typography';
import { cn } from '@/lib/utils';

/**
 * How many people opened a listing and how many asked to be told when it
 * frees up. Counts only — the API never says who.
 */
export function ListingStats({
  viewCount,
  watchCount,
  className,
}: {
  viewCount: number;
  watchCount: number;
  className?: string;
}) {
  const s = t.listingStats;
  const views =
    viewCount === 0 ? s.viewsNone : viewCount === 1 ? s.viewOne : s.views.replace('{n}', '\u0000');
  const watchers =
    watchCount === 0 ? s.watchersNone : watchCount === 1 ? s.watcherOne : s.watchers.replace('{n}', '\u0000');

  const withNumber = (text: string, n: number) => {
    const [before, after] = text.split('\u0000');
    return after === undefined ? (
      text
    ) : (
      <>
        {before}
        <Num board className="font-bold text-ink">
          {n}
        </Num>
        {after}
      </>
    );
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-soft">
        <li className="flex items-center gap-1.5">
          <Eye className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span>{withNumber(views, viewCount)}</span>
        </li>
        <li className="flex items-center gap-1.5">
          <Bell className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span>{withNumber(watchers, watchCount)}</span>
        </li>
      </ul>
      <p className="text-2xs text-muted">{s.hint}</p>
    </div>
  );
}
