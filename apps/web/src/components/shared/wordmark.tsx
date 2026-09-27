import { APP_NAME } from '@miftan/shared';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: { text: 'text-base', house: 'size-3' },
  md: { text: 'text-xl', house: 'size-3.5' },
  lg: { text: 'text-2xl', house: 'size-4' },
} as const;

/**
 * The brand: the name, heavy, closed by a small amber house.
 *
 * The house sits where a full stop would — at the end of the line, on the
 * baseline — so the mark reads as a sentence that ends at home. It is the one
 * place amber appears outside a date. No icon beside the name: the name
 * carries itself. On the dark top bar the letters flip to light ink; the
 * house stays amber on both.
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
        'inline-flex items-end gap-1 font-extrabold leading-none whitespace-nowrap',
        s.text,
        onInk ? 'text-on-ink' : 'text-ink',
        className,
      )}
    >
      {APP_NAME}
      <svg aria-hidden viewBox="0 0 16 16" className={cn('shrink-0 fill-signal', s.house)}>
        <path d="M2 8.5 8 3l6 5.5V14H2z" />
      </svg>
    </span>
  );
}
