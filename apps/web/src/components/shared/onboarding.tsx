import { useNavigate } from 'react-router-dom';
import { t } from '@miftan/shared';
import { useAuth } from '@/api/auth';
import { useDismissOnboarding } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Meter } from './meter';
import { Num } from './typography';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

type Role = 'owner' | 'tenant' | 'seeker';

export interface OnboardingStep {
  key: string;
  done: boolean;
  to: string;
}

/**
 * First-run checklist, one per role.
 *
 * Each step is ticked by the data, not by a click: a step is done when the
 * thing exists — a property, a tenant, a complete profile — so the list can
 * never claim progress that did not happen. It disappears when everything is
 * done or when the person closes it, and "closed" is stored on the account,
 * so it stays closed on the next phone too.
 */
export function Onboarding({ role, steps, className }: { role: Role; steps: OnboardingStep[]; className?: string }) {
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const dismiss = useDismissOnboarding();

  const copy = t.onboarding[role];
  const done = steps.filter((s) => s.done).length;

  /* `?? []`: the web app ships before the API does. An API one version behind
     does not send this field, and reading it bare took down the whole page. */
  const dismissed = user?.onboardingDismissed ?? [];
  if (!user || dismissed.includes(role) || done === steps.length) return null;

  const next = steps.find((s) => !s.done);
  const stepCopy = (key: string) => (copy.steps as Record<string, { title: string; body: string; cta: string }>)[key];

  return (
    <section
      className={cn(
        'rounded-[var(--radius-panel)] border border-line bg-surface p-5 motion-safe:animate-[fade-up_280ms_var(--ease-out)_both]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold text-ink">{copy.title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{copy.lede}</p>
        </div>
        <Button
          size="iconSm"
          variant="ghost"
          aria-label={t.onboarding.close}
          loading={dismiss.isPending}
          onClick={() => dismiss.mutate(role, { onSuccess: () => void refreshMe() })}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Meter value={done} max={steps.length} tone="ink" className="flex-1" label={copy.title} />
        <span className="shrink-0 text-2xs text-muted">
          {t.onboarding.progress.split(/(\{done\}|\{total\})/).map((part, i) =>
            part === '{done}' ? (
              <Num key={i} board className="font-bold text-ink">{done}</Num>
            ) : part === '{total}' ? (
              <Num key={i} board>{steps.length}</Num>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </span>
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => {
          const c = stepCopy(step.key);
          const isNext = step === next;
          return (
            <li
              key={step.key}
              className={cn(
                'flex items-start gap-3 rounded-[var(--radius-card)] border p-3',
                isNext ? 'border-ink bg-bg' : 'border-line bg-bg/60',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-2xs font-bold',
                  step.done ? 'bg-ink text-on-ink' : 'border border-line-strong text-muted',
                )}
                aria-label={step.done ? t.onboarding.done : undefined}
              >
                {step.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Num>{index + 1}</Num>}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-bold', step.done ? 'text-muted line-through' : 'text-ink')}>
                  {c.title}
                </span>
                {!step.done ? <span className="mt-0.5 block text-xs leading-5 text-ink-soft">{c.body}</span> : null}
              </span>
              {!step.done ? (
                <Button size="sm" variant={isNext ? 'primary' : 'secondary'} onClick={() => navigate(step.to)}>
                  {c.cta}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
