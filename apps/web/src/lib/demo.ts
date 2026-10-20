import { useAuth } from '@/api/auth';

/**
 * Two ways to be "demo".
 *
 * A build made with VITE_DEMO=true treats everyone as demo (a dedicated demo
 * site, if one ever returns). On the one live site, the seeded accounts —
 * Dana and the rest, ids usr_seed_* — are demo and real sign-ups are not:
 * the demo accounts keep the illustrated offers, the revenue model and the
 * reset button that are shown to landlords in meetings, and real users see
 * only what actually works.
 */
export const isDemoBuild = import.meta.env.VITE_DEMO === 'true';

export function useIsDemo(): boolean {
  const { user } = useAuth();
  return isDemoBuild || Boolean(user?.isDemo);
}
