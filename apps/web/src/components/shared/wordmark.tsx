import { APP_NAME } from '@miftan/shared';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: { text: 'text-base', dot: 'size-1.5' },
  md: { text: 'text-xl', dot: 'size-2' },
  lg: { text: 'text-2xl', dot: 'size-2.5' },
} as const;

/**
 * The brand: the name, heavy, and an amber full stop.
 *
 * The dot is the one place amber appears outside a date, and it earns it — it
 * is the full stop after a date, the thing the whole product is about. No
 * icon beside it: the name carries itself. On the dark top bar it flips to
 * light ink; the dot stays amber on both.
 */
export function Wordmark({
  size = 'md',
  onInk = false,
  className,
}: {
  size?: keyof typeof SIZES;
  onInk?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 font-extrabold leading-none whitespace-nowrap',
        s.text,
        onInk ? 'text-on-ink' : 'text-ink',
        className,
      )}
    >
      {APP_NAME}
      <span aria-hidden className={cn('inline-block shrink-0 rounded-full bg-signal', s.dot)} />
    </span>
  );
}
