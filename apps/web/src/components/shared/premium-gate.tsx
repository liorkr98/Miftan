import { Link } from 'react-router-dom';
import { t } from '@miftan/shared';
import { useAuth } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { EmptyState } from './empty-state';
import { Lock } from 'lucide-react';

/**
 * Fences off a feature reserved for the paid plan.
 *
 * The plan comes from the server on `/me`, and the server reads anything it
 * cannot vouch for as 'free'. This gate follows it: only an exact 'pro'
 * opens, so a missing user or an unknown value stays locked. There is no
 * billing provider yet — the demo accounts are seeded as 'pro' — so this is
 * what the product *presents*, not a payment check.
 *
 * HUMAN REVIEW: this decides what an account can open.
 */
export function useIsPro(): boolean {
  const { user } = useAuth();
  return user?.plan === 'pro';
}

export function PremiumGate({ hint, children }: { hint: string; children: React.ReactNode }) {
  const isPro = useIsPro();
  if (isPro) return <>{children}</>;

  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <EmptyState icon={Lock} title={t.premium.lockedTitle} hint={hint} />
        <Button asChild>
          <Link to="/pricing">{t.premium.seePlans}</Link>
        </Button>
      </div>
    </div>
  );
}
