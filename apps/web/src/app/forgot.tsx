import * as React from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME, ApiError, t } from '@miftan/shared';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Wordmark } from '@/components/shared/wordmark';

export function ForgotPassword() {
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? (t.auth.error[err.code] ?? t.auth.error.internal) : t.auth.error.internal);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6">
          <Link to="/" aria-label={APP_NAME}>
            <Wordmark size="lg" />
          </Link>
        </h1>
        <form onSubmit={submit} className="rounded-[var(--radius-panel)] border border-line bg-bg p-5 shadow-sm">
          <h2 className="mb-1 text-base font-bold text-ink">{t.auth.forgotTitle}</h2>
          <p className="mb-4 text-xs text-muted">{t.auth.forgotSubtitle}</p>
          {sent ? (
            <p role="status" className="text-sm font-semibold text-ink">
              {t.auth.forgotSent}
            </p>
          ) : (
            <>
              <Field label={t.auth.email}>
                <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              {error ? <p role="alert" className="mt-3 text-xs font-semibold text-alert">{error}</p> : null}
              <Button type="submit" size="lg" className="mt-4 w-full" loading={busy}>
                {t.auth.forgotSubmit}
              </Button>
            </>
          )}
        </form>
        <p className="mt-4 text-center text-xs">
          <Link to="/sign-in" className="font-bold text-ink underline-offset-2 hover:underline">
            {t.auth.backToSignIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
