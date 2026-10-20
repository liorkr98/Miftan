import * as React from 'react';

/**
 * The current time, as state. Screens that sort things into "past" and "still
 * ahead" re-render as the clock moves, instead of reading the clock mid-render
 * and freezing whatever it said at the time.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
