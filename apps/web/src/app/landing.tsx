import { Link, Navigate, useNavigate } from 'react-router-dom';
import { APP_NAME, LEGAL_PAGES, t } from '@miftan/shared';
import { useAuth } from '@/api/auth';
import { homeFor } from './guard';
import { rolesFor } from './role-switcher';
import { Button } from '@/components/ui/button';
import { Building2, DoorOpen, KeyRound, SearchCheck, ShieldCheck } from 'lucide-react';

/**
 * The public entry point.
 *
 * A signed-in visitor never sees this — they are redirected onward the moment
 * the session check resolves, the same guard sign-in and sign-up already use.
 * Everything below is for someone who has not opened an account yet.
 */
export function Landing() {
  const navigate = useNavigate();
  const { user, capabilities, restoring } = useAuth();

  if (restoring) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface">
        <div className="flex items-center gap-2.5 text-muted">
          <DoorOpen className="h-5 w-5 animate-pulse" />
          <span className="text-sm font-semibold">{APP_NAME}</span>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to={homeFor(rolesFor(capabilities))} replace />;

  return (
    <div className="bg-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-ink text-on-ink">
            <DoorOpen className="size-4.5" aria-hidden />
          </span>
          <span className="text-lg font-extrabold text-ink">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/sign-in')}>
            {t.landing.ctaSecondary}
          </Button>
          <Button onClick={() => navigate('/sign-up')}>{t.landing.ctaPrimary}</Button>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 pb-14 pt-8 text-center sm:pb-20 sm:pt-14">
        <p className="text-sm font-bold text-signal-deep">{t.landing.tagline}</p>
        <h1 className="mt-3 text-[clamp(1.9rem,5vw,3.2rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink text-balance">
          {t.landing.heroTitle}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink-soft">
          {t.landing.heroBody}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={() => navigate('/sign-up')}>
            {t.landing.ctaPrimary}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => navigate('/sign-in')}>
            {t.landing.ctaSecondary}
          </Button>
        </div>

        <DeparturesGlyph className="mx-auto mt-12 max-w-md" />
      </section>

      {/* ── How it works — the argument, not a disclaimer list ── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <h2 className="text-center text-2xl font-extrabold tracking-[-0.01em] text-ink">
            {t.landing.howItWorksTitle}
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <Step n={1} title={t.landing.step1Title} body={t.landing.step1Body} />
            <Step n={2} title={t.landing.step2Title} body={t.landing.step2Body} />
            <Step n={3} title={t.landing.step3Title} body={t.landing.step3Body} />
          </div>
        </div>
      </section>

      {/* ── Three audiences ─────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
        <h2 className="text-center text-2xl font-extrabold tracking-[-0.01em] text-ink">
          {t.landing.audiencesTitle}
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Audience Icon={Building2} title={t.landing.forOwners} body={t.landing.forOwnersBody} />
          <Audience Icon={KeyRound} title={t.landing.forTenants} body={t.landing.forTenantsBody} />
          <Audience
            Icon={SearchCheck}
            title={t.landing.forSeekers}
            body={t.landing.forSeekersBody}
          />
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="border-t border-line bg-ink">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-5 py-14 text-center sm:py-16">
          <ShieldCheck className="size-7 text-on-ink-muted" aria-hidden />
          <p className="max-w-md text-lg font-bold leading-8 text-on-ink">{t.landing.heroTitle}</p>
          <Button size="lg" onClick={() => navigate('/sign-up')}>
            {t.landing.finalCta}
          </Button>
        </div>
      </section>

      {/* ── Footer: legal ───────────────────────────────────── */}
      <footer className="mx-auto max-w-5xl px-5 py-8">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
          {LEGAL_PAGES.map((page) => (
            <Link key={page.id} to={`/legal/${page.id}`} className="hover:text-ink hover:underline">
              {page.title}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-center text-2xs text-muted">{t.legal.footerRights}</p>
      </footer>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div>
      <span
        aria-hidden
        className="num-board grid size-9 place-items-center rounded-full bg-ink text-sm font-bold text-on-ink"
      >
        {n}
      </span>
      <h3 className="mt-3 text-base font-bold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-ink-soft">{body}</p>
    </div>
  );
}

function Audience({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-5">
      <Icon className="size-5 text-ink-soft" aria-hidden />
      <h3 className="mt-3 text-sm font-bold text-ink">{title}</h3>
      <p className="mt-1 text-xs leading-6 text-muted">{body}</p>
    </div>
  );
}

/**
 * A small abstract echo of the departures board — the product's real
 * signature element, which lives in the authenticated app and reads from a
 * real portfolio. This is not that component: it draws no data, because a
 * public marketing page has no property to show. It is here only so a
 * visitor who later opens the app recognises the idea, not the pixels.
 */
function DeparturesGlyph({ className }: { className?: string }) {
  const rows = [
    { label: 'לבנדה 14', at: '62%', tone: 'var(--color-signal)' },
    { label: 'הרצל 88', at: '30%', tone: 'var(--color-live)' },
    { label: 'אבן גבירול 20', at: '85%', tone: 'var(--color-open)' },
  ];
  return (
    <div className={className} aria-hidden>
      <div className="space-y-2.5 rounded-[var(--radius-panel)] border border-line bg-surface p-4 text-start">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 truncate text-2xs font-semibold text-ink-soft">
              {r.label}
            </span>
            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunk">
              <span
                className="absolute inset-y-0 rounded-full"
                style={{ insetInlineStart: 0, width: r.at, backgroundColor: r.tone }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
