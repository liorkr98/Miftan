import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError, APP_NAME, t } from '@miftan/shared';
import { useAuth } from '@/api/auth';
import { homeFor } from './guard';
import { rolesFor } from './role-switcher';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { DoorOpen, LogIn } from 'lucide-react';

/** Seeded accounts, so the three sides of the product are one click apart. */
const DEMO_ACCOUNTS = [
  { role: t.roles.owner, email: 'ran@almog-nadlan.co.il', name: 'רן אלמוג' },
  { role: t.roles.tenant, email: 'michal.stern@gmail.com', name: 'מיכל שטרן' },
  { role: t.roles.seeker, email: 'tal.aviram@gmail.com', name: 'טל אבירם' },
];
const DEMO_PASSWORD = 'miftan-dev-2026';

export function SignIn() {
  const { signIn, user, capabilities, restoring } = useAuth();
  const location = useLocation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (withEmail = email, withPassword = password) => {
    setBusy(true);
    setError(null);
    try {
      await signIn(withEmail, withPassword);
    } catch (err) {
      /* The server sends a code, never a sentence — this is where it becomes
         Hebrew, which is what keeps the i18n seam intact. */
      const code = err instanceof ApiError ? err.code : 'offline';
      setError(t.auth.error[code as keyof typeof t.auth.error] ?? t.auth.error.internal);
    } finally {
      setBusy(false);
    }
  };

  /* Signing in has to move you somewhere. This page sits outside the guard —
     it has to, or you could never reach it — so the redirect belongs here. */
  if (user && !restoring) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? homeFor(rolesFor(capabilities))} replace />;
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-ink text-on-ink">
            <DoorOpen className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-[-0.01em] text-ink">{APP_NAME}</h1>
            <p className="text-2xs text-muted">{t.auth.subtitle}</p>
          </div>
        </div>

        <form
          className="space-y-4 rounded-[var(--radius-panel)] border border-line bg-bg p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h2 className="text-sm font-bold text-ink">{t.auth.title}</h2>

          <Field label={t.auth.email} htmlFor="email">
            <Input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label={t.auth.password} htmlFor="password">
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error ? (
            <p
              role="alert"
              className="rounded-[var(--radius-control)] border border-alert/30 bg-alert-soft px-3 py-2 text-xs font-semibold text-alert"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? t.auth.signingIn : t.auth.signIn}
            {!busy ? <LogIn className="h-4 w-4" /> : null}
          </Button>

          <p className="text-2xs leading-4 text-muted">{t.auth.noAccount}</p>
        </form>

        {import.meta.env.DEV ? (
          <section className="mt-5">
            <h2 className="text-xs font-bold text-ink">{t.auth.demoTitle}</h2>
            <p className="mb-2 text-2xs text-muted">{t.auth.demoHint}</p>
            <div className="grid gap-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(DEMO_PASSWORD);
                    void submit(account.email, DEMO_PASSWORD);
                  }}
                  className={cn(
                    'press-sm flex items-center gap-3 rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2 text-start',
                    'transition-[border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-line-strong',
                  )}
                >
                  <span className="text-xs font-bold text-ink">{account.role}</span>
                  <span className="text-2xs text-muted">{account.name}</span>
                  <span dir="ltr" className="ms-auto text-2xs text-muted">
                    {account.email}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
