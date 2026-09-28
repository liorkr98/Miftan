import type * as React from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME, t } from '@miftan/shared';
import { Building2, KeyRound, Search } from 'lucide-react';
import { Wordmark } from '@/components/shared/wordmark';
import { cn } from '@/lib/utils';

/**
 * Where an account that holds nothing yet lands.
 *
 * Roles here still come from what the account holds, so this is not a role
 * declaration — it is three doors. It exists because the old landing spot for
 * a new account was search, and the only way from there to "add a property"
 * was a secondary nav item that phones hide: a landlord signing up on a phone
 * had no visible way to do the one thing they came for.
 */
export function Welcome() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" aria-label={APP_NAME} className="mx-auto mb-6 flex w-fit items-center">
          <Wordmark size="lg" />
        </Link>
        <h1 className="text-center text-2xl font-extrabold text-ink">{t.welcome.title}</h1>
        <p className="mt-2 text-center text-sm leading-6 text-ink-soft">{t.welcome.lede}</p>

        <div className="mt-6 grid gap-3">
          <Door to="/start/owner" Icon={Building2} title={t.welcome.owner} hint={t.welcome.ownerHint} primary />
          <Door Icon={KeyRound} title={t.welcome.tenant} hint={t.welcome.tenantHint} />
          <Door to="/search" Icon={Search} title={t.welcome.seeker} hint={t.welcome.seekerHint} />
        </div>
      </div>
    </div>
  );
}

function Door({
  to,
  Icon,
  title,
  hint,
  primary = false,
}: {
  to?: string;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  primary?: boolean;
}) {
  const body = (
    <>
      <span
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-full',
          primary ? 'bg-ink text-on-ink' : 'bg-surface text-ink',
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block text-base font-bold text-ink">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-ink-soft">{hint}</span>
      </span>
    </>
  );
  const shell = cn(
    'flex items-start gap-3 rounded-[var(--radius-panel)] border bg-bg p-4',
    primary ? 'border-ink' : 'border-line',
  );
  /* The tenant door is information, not a link: the way in is the landlord's
     invite, which only the landlord can send. */
  if (!to) return <div className={shell}>{body}</div>;
  return (
    <Link to={to} className={cn(shell, 'press hover:bg-surface')}>
      {body}
    </Link>
  );
}
