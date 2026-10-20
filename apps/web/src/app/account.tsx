import * as React from 'react';
import { APP_NAME, ApiError, t } from '@miftan/shared';
import { api } from '@/api/client';
import { useAuth } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { PageHeader } from '@/components/shared/typography';

interface SessionRow {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  current: boolean;
}

export function Account() {
  const { user, refreshMe, signOut } = useAuth();
  const [name, setName] = React.useState(user?.name ?? '');
  const [email, setEmail] = React.useState('');
  const [emailPassword, setEmailPassword] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [deletePassword, setDeletePassword] = React.useState('');
  const [sessions, setSessions] = React.useState<SessionRow[]>([]);
  const [note, setNote] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void api.request<{ sessions: SessionRow[] }>('/me/sessions').then((r) => setSessions(r.sessions));
  }, []);

  function fail(err: unknown) {
    setError(err instanceof ApiError ? (t.auth.error[err.code] ?? t.auth.error.internal) : t.auth.error.internal);
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t.account.title} subtitle={t.account.subtitle} />
      {error ? <p role="alert" className="mb-4 text-xs font-semibold text-alert">{error}</p> : null}
      {note ? <p role="status" className="mb-4 text-xs font-semibold text-ink">{note}</p> : null}

      <section className="grid gap-3 rounded-[var(--radius-panel)] border border-line bg-bg p-5">
        <h2 className="text-sm font-bold">{t.account.profile}</h2>
        <Field label={t.auth.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <p className="text-xs text-muted" dir="ltr">{user?.email}</p>
        <Button
          onClick={() => {
            void api.request('/me/renter-profile', { method: 'PATCH', body: JSON.stringify({ name }) })
              .then(() => refreshMe())
              .then(() => setNote(t.ui.saved))
              .catch(fail);
          }}
        >
          {t.account.saveProfile}
        </Button>
      </section>

      <section className="mt-4 grid gap-3 rounded-[var(--radius-panel)] border border-line bg-bg p-5">
        <h2 className="text-sm font-bold">{t.account.email}</h2>
        <Field label={t.account.changeEmail}>
          <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t.account.currentPassword}>
          <Input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
        </Field>
        <Button
          variant="secondary"
          onClick={() => {
            void api.request('/me/email', { method: 'POST', body: JSON.stringify({ email, password: emailPassword }) })
              .then(() => setNote(t.account.emailPending))
              .catch(fail);
          }}
        >
          {t.account.changeEmail}
        </Button>
      </section>

      <section className="mt-4 grid gap-3 rounded-[var(--radius-panel)] border border-line bg-bg p-5">
        <h2 className="text-sm font-bold">{t.account.password}</h2>
        <Field label={t.account.currentPassword}>
          <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </Field>
        <Field label={t.account.newPassword} hint={t.auth.passwordHint}>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={10} />
        </Field>
        <Button
          variant="secondary"
          onClick={() => {
            void api.request('/me/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
              .then(() => setNote(t.account.passwordChanged))
              .catch(fail);
          }}
        >
          {t.account.changePassword}
        </Button>
      </section>

      <section className="mt-4 grid gap-3 rounded-[var(--radius-panel)] border border-line bg-bg p-5">
        <h2 className="text-sm font-bold">{t.account.sessions}</h2>
        <ul className="grid gap-2 text-xs">
          {sessions.map((row) => (
            <li key={row.id} className="rounded-[var(--radius-control)] border border-line px-3 py-2">
              <p className="font-semibold">{row.current ? t.account.thisDevice : row.userAgent ?? APP_NAME}</p>
              <p className="text-muted" dir="ltr">{row.ip}</p>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          onClick={() => {
            void api.request('/me/sessions/revoke-all', { method: 'POST' })
              .then(() => signOut())
              .catch(fail);
          }}
        >
          {t.account.revokeAll}
        </Button>
      </section>

      <section className="mt-4 grid gap-3 rounded-[var(--radius-panel)] border border-line bg-bg p-5">
        <h2 className="text-sm font-bold">{t.account.notifyTitle}</h2>
        <p className="text-xs text-muted">{t.account.notifyBody}</p>
      </section>

      <section className="mt-4 grid gap-3 rounded-[var(--radius-panel)] border border-line bg-bg p-5">
        <h2 className="text-sm font-bold">{t.account.export}</h2>
        <Button
          variant="secondary"
          onClick={() => {
            void api.request<Record<string, unknown>>('/me/export').then((data) => {
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const href = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = href;
              a.download = 'baalabait-export.json';
              a.click();
              URL.revokeObjectURL(href);
            }).catch(fail);
          }}
        >
          {t.account.exportAction}
        </Button>
      </section>

      <section className="mt-4 grid gap-3 rounded-[var(--radius-panel)] border border-alert/30 bg-bg p-5">
        <h2 className="text-sm font-bold text-alert">{t.account.delete}</h2>
        <p className="text-xs text-muted">{t.account.deleteHint}</p>
        <Field label={t.account.currentPassword}>
          <Input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
        </Field>
        <Button
          variant="danger"
          onClick={() => {
            void api.request('/me/delete', { method: 'POST', body: JSON.stringify({ password: deletePassword }) })
              .then(() => signOut())
              .catch(fail);
          }}
        >
          {t.account.deleteAction}
        </Button>
      </section>
    </div>
  );
}
