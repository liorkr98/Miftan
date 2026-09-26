import { t } from '@miftan/shared';
import { EmptyState } from './empty-state';
import { Lock } from 'lucide-react';

/**
 * Fences off a feature reserved for a paid plan.
 *
 * There is no billing system yet, so this is not authorization — it is a
 * single switch that decides what to *present* as locked, kept in one place
 * so turning a feature on later is one line, not a search-and-replace across
 * every screen that mentions it.
 *
 * No call-to-action button: there is nothing behind one yet — no plan to
 * upgrade to, no waitlist to join — and a button that does nothing on click
 * is worse than no button. The rail's own lock badge is what tells someone
 * this exists at all; this screen just explains why they cannot open it.
 *
 * The revenue/income-model page is the first tenant: real, finished code,
 * just not something every account should see by default. Gating it here
 * rather than deleting it means switching it on later costs one line.
 */
export const PREMIUM_ENABLED = false;

export function PremiumGate({ hint, children }: { hint: string; children: React.ReactNode }) {
  if (PREMIUM_ENABLED) return <>{children}</>;

  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <EmptyState icon={Lock} title={t.premium.lockedTitle} hint={hint} className="max-w-md" />
    </div>
  );
}
