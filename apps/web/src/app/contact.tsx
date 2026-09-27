import { Link } from 'react-router-dom';
import { APP_NAME, SUPPORT, t } from '@miftan/shared';
import { Wordmark } from '@/components/shared/wordmark';

export function Contact() {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-5">
        <Link to="/" aria-label={APP_NAME}>
          <Wordmark size="sm" />
        </Link>
        <Link to="/" className="text-xs font-semibold text-muted hover:text-ink hover:underline">
          {t.legal.backToApp}
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-16">
        <h1 className="text-xl font-extrabold text-ink">{t.contact.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.contact.subtitle}</p>
        <dl className="mt-6 grid gap-4 text-sm">
          <div>
            <dt className="text-xs font-bold text-ink-soft">{t.contact.email}</dt>
            <dd>
              <a dir="ltr" className="font-semibold text-ink underline" href={`mailto:${SUPPORT.email}`}>
                {SUPPORT.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-ink-soft">{t.contact.whatsapp}</dt>
            <dd className="text-ink-soft">{t.contact.whatsappSoon}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-ink-soft">{t.contact.hours}</dt>
            <dd>{SUPPORT.hours}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-ink-soft">{t.contact.reply}</dt>
            <dd>{SUPPORT.reply}</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
