import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError, APP_NAME, t, formatDate } from '@miftan/shared';
import { useAuth } from '@/api/auth';
import { useAcceptInvite, useInvitePreview } from '@/api/hooks';
import { useStore } from '@/data/store';
import { Money, Num } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ListSkeleton } from '@/components/shared/skeleton';
import { Button } from '@/components/ui/button';
import { KeyRound, LinkIcon } from 'lucide-react';
import { Wordmark } from '@/components/shared/wordmark';

/**
 * Where an invite link lands.
 *
 * Public, because the person holding the link often has no account yet. It
 * shows the flat and the terms the owner fixed; signing up or in brings them
 * straight back here, and accepting makes them the tenant on those terms.
 */
export function Join() {
  const { token = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, restoring, refreshMe } = useAuth();
  const pushToast = useStore((s) => s.pushToast);
  const preview = useInvitePreview(token);
  const accept = useAcceptInvite();

  const back = { from: location.pathname };

  const shell = (children: ReactNode) => (
    <div className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" aria-label={APP_NAME} className="mb-6 flex w-fit items-center">
          <Wordmark size="lg" />
        </Link>
        {children}
      </div>
    </div>
  );

  if (preview.isLoading || restoring) return shell(<ListSkeleton rows={4} />);

  if (preview.isError || !preview.data) {
    const missing = preview.error instanceof ApiError && preview.error.code === 'not_found';
    return shell(
      <EmptyState
        icon={LinkIcon}
        title={t.join.title}
        hint={missing ? t.join.unavailable.missing : t.auth.error.internal}
        className="bg-bg"
      />,
    );
  }

  const invite = preview.data;
  if (invite.status !== 'open') {
    return shell(
      <EmptyState icon={LinkIcon} title={t.join.title} hint={t.join.unavailable[invite.status]} className="bg-bg" />,
    );
  }

  const onAccept = () =>
    accept.mutate(token, {
      onSuccess: async () => {
        /* The account just gained the tenant role; the shell reads it from /me. */
        await refreshMe();
        pushToast(t.join.done, 'success');
        navigate('/tenant', { replace: true });
      },
      onError: () => pushToast(t.join.failed, 'alert'),
    });

  return shell(
    <section className="rounded-[var(--radius-panel)] border border-line bg-bg p-5">
      <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-surface text-ink">
        <KeyRound className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm text-ink-soft">{t.join.from.replace('{name}', invite.ownerFirstName)}</p>
      <h1 className="mt-1 text-2xl font-extrabold text-ink">
        {invite.propertyLabel}
        <span className="text-base font-semibold text-muted"> · {invite.city}</span>
      </h1>

      <h2 className="mb-2 mt-6 text-xs font-bold text-muted">{t.join.terms}</h2>
      <dl className="divide-y divide-line rounded-[var(--radius-control)] border border-line text-sm">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-muted">{t.join.period}</dt>
          <dd>
            <Num board className="text-ink">
              {formatDate(invite.startDate)} — {formatDate(invite.endDate)}
            </Num>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-muted">{t.join.rent}</dt>
          <dd>
            <Money agorot={invite.monthlyRentAgorot} board className="font-bold text-ink" />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-muted">{t.join.deposit}</dt>
          <dd>
            <Money agorot={invite.depositAgorot} board className="text-ink" />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-muted">{t.join.payment}</dt>
          <dd className="text-ink">{t.paymentMethod[invite.paymentMethod]}</dd>
        </div>
      </dl>

      <p className="mt-4 text-2xs leading-5 text-muted">{t.join.note}</p>

      {user ? (
        <Button size="lg" className="mt-5 w-full" loading={accept.isPending} onClick={onAccept}>
          {t.join.accept}
        </Button>
      ) : (
        <div className="mt-5 space-y-2">
          <p className="text-xs text-ink-soft">{t.join.notYou}</p>
          <Button asChild size="lg" className="w-full">
            <Link to="/sign-up" state={back}>
              {t.join.signUpFirst}
            </Link>
          </Button>
          <Button asChild size="lg" variant="quiet" className="w-full">
            <Link to="/sign-in" state={back}>
              {t.join.signInFirst}
            </Link>
          </Button>
        </div>
      )}
      <p className="mt-4 text-center text-2xs text-muted">
        {t.invites.expires} <Num board>{formatDate(invite.expiresAt)}</Num>
      </p>
    </section>,
  );
}
