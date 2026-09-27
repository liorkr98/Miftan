import { APP_NAME } from '@miftan/shared';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
} as const;

/**
 * The brand: the name, heavy, with a small amber house over its first
 * letter — the ב of בית sits under its own roof.
 *
 * Everything is sized in em, so the house scales with the type at every
 * size, and it is centred with logical insets (start-0 end-0 mx-auto), so it
 * stays over the first letter in RTL without a physical side anywhere. The
 * top padding reserves the house's height, so the mark never overlaps what
 * sits above it. Amber here is the brand's one exception to "amber means a
 * date"; the letters flip to light ink on the dark top bar, the house stays.
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
  const [first, ...rest] = Array.from(APP_NAME);
  return (
    <span
      className={cn(
        'inline-block pt-[0.42em] font-extrabold leading-none whitespace-nowrap',
        SIZES[size],
        onInk ? 'text-on-ink' : 'text-ink',
        className,
      )}
    >
      <span className="relative inline-block">
        {first}
        <svg
          aria-hidden
          viewBox="0 0 16 14"
          className="absolute start-0 end-0 -top-[0.46em] mx-auto h-[0.4em] w-[0.46em] fill-signal"
        >
          <path d="M2 8.5 8 3l6 5.5V14H2z" />
        </svg>
      </span>
      {rest.join('')}
    </span>
  );
}
