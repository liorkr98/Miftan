import { Link } from 'react-router-dom';
import {
  ADD_ONS,
  APP_NAME,
  OWNER_PLANS,
  SERVICE_PRICES,
  SERVICE_PRICES_SOURCE,
  t,
} from '@miftan/shared';
import { useAuth } from '@/api/auth';
import { Money, Num } from '@/components/shared/typography';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowLeft, Check, KeyRound, Search } from 'lucide-react';
import { homeFor } from './guard';
import { rolesFor } from './role-switcher';
import { Wordmark } from '@/components/shared/wordmark';

/**
 * One price list for all three sides.
 *
 * Owners pay per unit; tenants and seekers pay nothing and cannot buy a
 * place in a queue — the page says that as plainly as it states a price,
 * because it is the same promise. Below the plans, a guide to what the work
 * around a rental typically costs, from Midrag's published averages, so an
 * owner can tell a fair quote from a bad one. Public, like the landing page.
 */
export function Pricing() {
  const { user, capabilities } = useAuth();
  const home = user ? homeFor(rolesFor(capabilities)) : null;
  const currentPlan = user?.plan;

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-8">
        <Link to="/" aria-label={APP_NAME} className="flex min-h-11 items-center">
          <Wordmark size="md" />
        </Link>
        <nav className="ms-auto flex items-center gap-1.5">
          {home ? (
            <Button asChild size="sm">
              <Link to={home}>
                {APP_NAME}
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="quiet" size="sm">
                <Link to="/sign-in">{t.landing.signIn}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/sign-up">{t.landing.signUp}</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        {/* ── Hero ───────────────────────────────────────── */}
        <section className="stagger max-w-2xl pb-12 pt-10 sm:pb-16 sm:pt-16">
          <p className="text-sm font-semibold text-muted">{t.pricing.title}</p>
          <h1 className="mt-3 text-[2.25rem] font-extrabold leading-[1.15] text-ink sm:text-[3rem]">
            {t.pricing.headline}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">{t.pricing.lede}</p>
        </section>

        {/* ── Owners ─────────────────────────────────────── */}
        <section aria-labelledby="owners">
          <h2 id="owners" className="text-xl font-extrabold text-ink">
            {t.pricing.owners}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {OWNER_PLANS.map((plan) => {
              const copy = t.pricing.plans[plan.id];
              const isCurrent = currentPlan !== undefined && (plan.id === currentPlan);
              return (
                <article
                  key={plan.id}
                  className={cn(
                    'flex flex-col rounded-[var(--radius-panel)] border p-6',
                    plan.highlighted ? 'border-ink shadow-[0_24px_60px_-40px_oklch(0.245_0.018_52/0.55)]' : 'border-line',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-ink">{copy.name}</h3>
                    {isCurrent ? (
                      <Badge tone="openSoft" size="sm">
                        {t.pricing.current}
                      </Badge>
                    ) : plan.highlighted ? (
                      <Badge tone="neutral" size="sm">
                        {t.pricing.popular}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{copy.tagline}</p>

                  <div className="mt-6 flex items-baseline gap-2">
                    {plan.perUnitMonthly !== null ? (
                      <>
                        <Money value={plan.perUnitMonthly} className="text-4xl font-extrabold text-ink" />
                        <span className="text-sm text-muted">{t.pricing.perUnit}</span>
                      </>
                    ) : (
                      <span className="text-4xl font-extrabold text-ink">
                        {plan.id === 'free' ? t.pricing.free : t.pricing.quoted}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {plan.maxUnits !== null ? (
                      t.pricing.upTo.split('{n}').map((part, i) =>
                        i === 0 ? (
                          <span key={i}>{part}</span>
                        ) : (
                          <span key={i}>
                            <Num>{plan.maxUnits}</Num>
                            {part}
                          </span>
                        ),
                      )
                    ) : (
                      t.pricing.unlimited
                    )}
                  </p>

                  <ul className="mt-6 flex-1 space-y-2.5 border-t border-line pt-5">
                    {copy.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-soft">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    size="lg"
                    variant={plan.highlighted ? 'primary' : 'secondary'}
                    className="mt-6 w-full"
                  >
                    <Link to={user ? (home ?? '/') : '/sign-up'}>{t.pricing.choose}</Link>
                  </Button>
                </article>
              );
            })}
          </div>

          {/* Add-ons */}
          <div className="mt-6 rounded-[var(--radius-card)] border border-line p-5">
            <h3 className="text-sm font-bold text-ink">{t.pricing.addOnsTitle}</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {ADD_ONS.map((addOn) => (
                <li key={addOn.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink-soft">
                    {t.pricing.addOns[addOn.id].name}
                    <span className="text-2xs text-muted"> · {t.pricing.addOns[addOn.id].unit}</span>
                  </span>
                  <Money value={addOn.price} board className="font-bold text-ink" />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Tenants and seekers ────────────────────────── */}
        <section className="mt-14 grid gap-4 md:grid-cols-2">
          {[
            { key: 'tenants', Icon: KeyRound, title: t.pricing.tenantsTitle, body: t.pricing.tenantsBody },
            { key: 'seekers', Icon: Search, title: t.pricing.seekersTitle, body: t.pricing.seekersBody },
          ].map(({ key, Icon, title, body }) => (
            <article key={key} className="rounded-[var(--radius-panel)] border border-line bg-surface p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <Icon className="h-5 w-5 text-ink" />
                  <h2 className="text-lg font-bold text-ink">{title}</h2>
                </span>
                <span className="text-2xl font-extrabold text-ink">{t.pricing.free}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-soft">{body}</p>
            </article>
          ))}
        </section>

        {/* ── What the work costs ────────────────────────── */}
        <section className="mt-16" aria-labelledby="services">
          <h2 id="services" className="text-xl font-extrabold text-ink">
            {t.pricing.servicesTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{t.pricing.servicesLede}</p>
          <div className="mt-5 overflow-hidden rounded-[var(--radius-card)] border border-line">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface text-2xs text-muted">
                  <th className="p-3 text-start font-bold">{t.pricing.service}</th>
                  <th className="p-3 text-start font-bold">{t.pricing.range}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {SERVICE_PRICES.map((row) => (
                  <tr key={row.id} className="text-sm">
                    <td className="p-3 text-ink-soft">{t.pricing.services[row.id]}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                        <Money value={row.min} board />
                        {row.max !== row.min ? (
                          <>
                            <span className="text-muted">–</span>
                            <Money value={row.max} board />
                          </>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-2xs text-muted">
            <a href={SERVICE_PRICES_SOURCE} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {t.pricing.servicesSource}
            </a>
          </p>
        </section>

        {/* ── Questions ──────────────────────────────────── */}
        <section className="mt-16 max-w-3xl">
          <h2 className="text-xl font-extrabold text-ink">{t.pricing.faqTitle}</h2>
          <dl className="mt-5 divide-y divide-line border-y border-line">
            {t.pricing.faq.map((item) => (
              <div key={item.q} className="py-4">
                <dt className="text-sm font-bold text-ink">{item.q}</dt>
                <dd className="mt-1.5 text-sm leading-6 text-ink-soft">{item.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-2xs text-muted">{t.pricing.note}</p>
        </section>
      </main>
    </div>
  );
}
