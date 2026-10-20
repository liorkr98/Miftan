import * as React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { APP_NAME, t } from '@miftan/shared';
import { api } from '@/api/client';
import { useAuth } from '@/api/auth';
import { homeFor } from './guard';
import { rolesFor } from './role-switcher';
import { Wordmark } from '@/components/shared/wordmark';

export function VerifyEmail() {
  const { token = '' } = useParams<{ token: string }>();
  const { refreshMe, user, capabilities, restoring } = useAuth();
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await api.verifyEmail(token);
        await refreshMe();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refreshMe]);

  if (user && !restoring) {
    return <Navigate to={homeFor(rolesFor(capabilities))} replace />;
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <Link to="/" aria-label={APP_NAME}>
          <Wordmark size="lg" />
        </Link>
        <h1 className="mt-6 text-base font-bold text-ink">{t.auth.verifyTitle}</h1>
        <p className="mt-2 text-sm text-muted">{failed ? t.auth.verifyFailed : t.auth.verifyWorking}</p>
        {failed ? (
          <Link to="/sign-in" className="mt-4 inline-block text-xs font-bold text-ink underline">
            {t.auth.backToSignIn}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
