import { useEffect, useState } from 'react';

/**
 * List views show skeletons for one frame-ish beat so the demo settles into
 * place instead of flashing. Respects reduced-motion by resolving instantly.
 */
export function useDelayedReady(delay = 260): boolean {
  const [ready, setReady] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(id);
  }, [ready, delay]);

  return ready;
}
