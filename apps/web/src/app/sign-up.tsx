import * as React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError, APP_NAME, t } from '@miftan/shared';
import { useAuth } from '@/api/auth';
import { homeFor } from './guard';
import { rolesFor } from './role-switcher';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { DoorOpen, UserPlus } from 'lucide-react';

const MIN_PASSWORD = 10;

/**
 * Opening an account.
 *
 * The form asks for nothing about *why* you are here. There is no "I am a
 * landlord / tenant / looking" step, because role in this product is a
 * consequence of what the account holds — a property you added, a lease an
 * owner attached you to, a queue you joined — not a declaration made before you
 * have done any of them. Asking would produce an answer the system then has to
 * either trust or ignore, and both are worse than deriving it.
 */
export function SignUp() {
  const navigate = useNavigate();
  const { signUp, user, capabilities, restoring } = useAuth();

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (user && !restoring) {
    return <Navigate to={homeFor(rolesFor(capabilities))} replace />;
  }

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        /* Optional, and sent as absent rather than as an empty string — the
           schema would reject "" as a malformed phone number. */
        phone: phone.trim() || undefined,
        password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (t.auth.error[err.code] ?? t.auth.error.internal)
          : t.auth.error.internal,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[var(--radius-control)] bg-ink text-on-ink">
            <DoorOpen className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-ink">{APP_NAME}</h1>
            <p className="text-xs text-muted">{t.auth.signUpSubtitle}</p>
          </div>
        </header>

        <form
          onSubmit={submit}
          className="rounded-[var(--radius-panel)] border border-line bg-bg p-5 shadow-sm"
        >
          <h2 className="mb-4 text-base font-bold text-ink">{t.auth.signUpTitle}</h2>

          <div className="grid gap-3.5">
            <Field label={t.auth.name}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.auth.namePlaceholder}
                autoComplete="name"
                required
              />
            </Field>

            <Field label={t.auth.email}>
              <Input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>

            <Field label={t.auth.phone} hint={t.auth.phoneOptional}>
              <Input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="050-0000000"
              />
            </Field>

            <Field label={t.auth.password} hint={t.auth.passwordHint}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                aria-invalid={tooShort || undefined}
                required
              />
            </Field>
          </div>

          {error ? (
            <p role="alert" className="mt-3 text-xs font-semibold text-alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" loading={busy} className="mt-4 w-full">
            <UserPlus className="size-4" aria-hidden />
            {busy ? t.auth.signingUp : t.auth.signUp}
          </Button>

          <p className="mt-3 text-2xs leading-relaxed text-muted">{t.auth.roleNote}</p>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          {t.auth.haveAccount}{' '}
          <Link to="/sign-in" className="font-bold text-ink underline-offset-2 hover:underline">
            {t.auth.backToSignIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
