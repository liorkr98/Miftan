/**
 * RTL helpers.
 *
 * The rule in this codebase: layout uses logical properties (ms/me/ps/pe,
 * start/end) and never hardcodes left/right. The two places that genuinely
 * cannot be expressed logically are (a) chevrons, which must mirror, and
 * (b) the departures board, which positions bars along a time axis by
 * percentage — and in Hebrew, time runs RIGHT to LEFT.
 */

/** Hebrew reads right-to-left, so "today" is pinned at the RIGHT edge and the
 *  future extends LEFT. Inside a `dir=rtl` container, `inset-inline-start`
 *  measures from the RIGHT edge, so a ratio maps to it directly: ratio 0 is
 *  today (flush right), ratio 1 is the far end of the window (flush left). */
export function trackOffset(ratio: number): { insetInlineStart: string } {
  return { insetInlineStart: `${ratio * 100}%` };
}

/** Width + start offset for a bar spanning [fromRatio, toRatio] of the track. */
export function trackSpan(fromRatio: number, toRatio: number) {
  const a = Math.max(0, Math.min(1, fromRatio));
  const b = Math.max(0, Math.min(1, toRatio));
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return {
    insetInlineStart: `${lo * 100}%`,
    width: `${(hi - lo) * 100}%`,
  };
}

/** Map a date onto a 0..1 ratio across the board window. */
export function dateRatio(date: Date, start: Date, end: Date): number {
  const span = end.getTime() - start.getTime();
  if (span <= 0) return 0;
  return (date.getTime() - start.getTime()) / span;
}

/** In RTL, "next" (forward in reading order) is the LEFT arrow. */
export const chevronNext = 'ChevronLeft' as const;
export const chevronPrev = 'ChevronRight' as const;

/** Keyboard arrows are mirrored in RTL for horizontal navigation. */
export function horizontalKeyDelta(key: string): -1 | 0 | 1 {
  if (key === 'ArrowLeft') return 1; // left = forward in RTL
  if (key === 'ArrowRight') return -1; // right = back in RTL
  return 0;
}
