import * as React from 'react';
import { Link } from 'react-router-dom';
import { addMonths } from 'date-fns';
import { APP_NAME, LEGAL_PAGES, t, type TrackRow } from '@miftan/shared';
import { DepartureTrack } from '@/components/shared/departure-track';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, DoorOpen, KeyRound, Scale, Search, ShieldCheck, Sigma } from 'lucide-react';

/**
 * The page before sign-in.
 *
 * It says one thing — every apartment has a date — and then shows it, with
 * the real departures board rather than a picture of one. The board is the
 * only amber on the page: amber means "a date exists", and a landing page is
 * exactly where the temptation to spend it on decoration is strongest.
 *
 * Breathing room comes from space, not from ornament. The motion is two slow
 * things — the grid behind the hero, and a line sweeping the board from today
 * into the future — and both stop under reduced motion.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);

function sampleRows(): TrackRow[] {
  const today = new Date();
  const b = t.landing.board;
  const row = (
    id: keyof typeof b,
    tone: TrackRow['tone'],
    confidence: TrackRow['confidence'],
    rent: number,
    monthsAhead?: number,
  ): TrackRow => ({
    id,
    property_id: id,
    label: b[id].label,
    sublabel: b[id].sublabel,
    from: iso(today),
    until: monthsAhead === undefined ? undefined : iso(addMonths(today, monthsAhead)),
    tone,
    confidence,
    meta: String(rent),
  });

  /* Ordered like a departures list: free now, then by date, then the flat
     whose tenant is staying — occupied, with no departure in sight. */
  return [
    row('r3', 'open', 'confirmed', 4300),
    row('r1', 'signal', 'confirmed', 6800, 2),
    row('r2', 'signal', 'likely', 5900, 4),
    row('r4', 'signal', 'confirmed', 8200, 9),
    row('r5', 'live', 'confirmed', 7400),
  ];
}

const ROLE_ICONS = { owner: Building2, tenant: KeyRound, seeker: Search } as const;
const PRINCIPLE_ICONS = { privacy: ShieldCheck, fair: Scale, honest: Sigma } as const;

export function Landing() {
  const rows = React.useMemo(sampleRows, []);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-ink text-on-ink">
            <DoorOpen className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-extrabold text-ink">{APP_NAME}</span>
        </Link>
        <nav className="ms-auto flex items-center gap-1.5">
          <Button asChild variant="quiet" size="sm">
            <Link to="/sign-in">{t.landing.signIn}</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/sign-up">{t.landing.signUp}</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="landing-grid absolute inset-0 -z-10" />
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-24">
            <div className="stagger max-w-2xl">
              <p className="text-sm font-semibold text-muted">{t.landing.eyebrow}</p>
              <h1 className="mt-4 text-[2.5rem] font-extrabold leading-[1.15] text-ink sm:text-[3.5rem]">
                {t.landing.headline}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-ink-soft">{t.landing.lede}</p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/sign-up">
                    {t.landing.primaryCta}
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="quiet">
                  <Link to="/sign-in">{t.landing.secondaryCta}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── The board — the thesis, not a picture of it ── */}
        <section className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-[0_24px_60px_-40px_oklch(0.245_0.018_52/0.45)] sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-sm font-bold text-ink">{t.landing.boardTitle}</h2>
              <span className="flex items-center gap-1.5 text-2xs text-muted">
                <span aria-hidden className="landing-pulse h-1.5 w-1.5 rounded-full bg-ink" />
                {t.landing.boardLive}
              </span>
            </div>
            <div className="relative">
              <DepartureTrack rows={rows} months={12} showRent className="bg-bg" />
              {/* Today → the future. Desktop only: on a phone the board is a
                  month list, and a sweeping line over a list means nothing. */}
              <div aria-hidden className="pointer-events-none absolute inset-y-0 start-[9.5rem] end-3 hidden md:block">
                <span className="landing-sweep absolute inset-y-8 w-px bg-ink/25" />
              </div>
            </div>
            <p className="mt-3 text-2xs text-muted">{t.landing.boardCaption}</p>
          </div>
        </section>

        {/* ── Three people ──────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
          <div className="max-w-xl">
            <h2 className="text-[1.75rem] font-extrabold leading-tight text-ink sm:text-[2.05rem]">
              {t.landing.rolesTitle}
            </h2>
            <p className="mt-3 text-base leading-7 text-ink-soft">{t.landing.rolesLede}</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {(['owner', 'tenant', 'seeker'] as const).map((key) => {
              const role = t.landing.roles[key];
              const Icon = ROLE_ICONS[key];
              return (
                <article
                  key={key}
                  className="rounded-[var(--radius-panel)] border border-line p-6 transition-[border-color,transform] duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-line-strong"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-surface text-ink">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-ink">{role.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{role.body}</p>
                  <ul className="mt-5 space-y-2 border-t border-line pt-5">
                    {role.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm text-ink-soft">
                        <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── What we will not do ───────────────────────── */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
            <h2 className="text-sm font-bold text-muted">{t.landing.principlesTitle}</h2>
            <div className="mt-8 grid gap-10 md:grid-cols-3">
              {(['privacy', 'fair', 'honest'] as const).map((key) => {
                const item = t.landing.principles[key];
                const Icon = PRINCIPLE_ICONS[key];
                return (
                  <div key={key}>
                    <Icon className="h-5 w-5 text-ink" />
                    <h3 className="mt-4 text-base font-bold text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Close ─────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
          <div className="rounded-[var(--radius-panel)] bg-ink px-6 py-14 text-center sm:px-12 sm:py-20">
            <h2 className="text-[1.75rem] font-extrabold leading-tight text-on-ink sm:text-[2.4rem]">
              {t.landing.closingTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-on-ink-muted">{t.landing.closingBody}</p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/sign-up"
                className="press inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] bg-bg px-6 text-base font-bold text-ink transition-colors duration-150 hover:bg-surface"
              >
                {t.landing.primaryCta}
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link
                to="/sign-in"
                className="inline-flex h-12 items-center rounded-[var(--radius-control)] px-5 text-base font-semibold text-on-ink-muted transition-colors duration-150 hover:text-on-ink"
              >
                {t.landing.secondaryCta}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-8">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
          {LEGAL_PAGES.map((page) => (
            <Link key={page.id} to={`/legal/${page.id}`} className="hover:text-ink hover:underline">
              {page.title}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-center text-2xs text-muted">{t.landing.footer}</p>
      </footer>
    </div>
  );
}
