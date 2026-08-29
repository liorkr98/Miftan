import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t, formatTime, formatWeekdayDate, type Severity, type TicketCategory } from '@miftach/shared';
import { Num, PageHeader } from '@/components/shared/typography';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import {
  AirVent,
  Camera,
  CheckCircle2,
  Droplets,
  Flame,
  KeyRound,
  PaintRoller,
  Plug,
  CircleEllipsis,
  WashingMachine,
  Wrench,
  X,
} from 'lucide-react';

const CATEGORIES: { id: TicketCategory; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ac', Icon: AirVent },
  { id: 'leak', Icon: Droplets },
  { id: 'electrical', Icon: Plug },
  { id: 'plumbing', Icon: Wrench },
  { id: 'boiler', Icon: Flame },
  { id: 'appliance', Icon: WashingMachine },
  { id: 'lock', Icon: KeyRound },
  { id: 'paint', Icon: PaintRoller },
  { id: 'other', Icon: CircleEllipsis },
];

const SEVERITIES: Severity[] = ['low', 'medium', 'urgent'];

/** Three plausible visit windows, generated from today. */
function buildSlots(): string[] {
  const out: string[] = [];
  for (const [dayOffset, hour] of [
    [0, 17],
    [1, 9],
    [1, 16],
    [2, 11],
    [3, 18],
  ] as const) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    out.push(d.toISOString());
  }
  return out;
}

export function TenantReport() {
  const navigate = useNavigate();
  const createTicket = useStore((s) => s.createTicket);
  const pushToast = useStore((s) => s.pushToast);
  const { properties, leases, currentTenantId } = useStoreShallow((s) => ({
    properties: s.properties,
    leases: s.leases,
    currentTenantId: s.currentTenantId,
  }));

  const lease = leases.find((l) => l.tenant_id === currentTenantId);
  const property = lease ? properties.find((p) => p.id === lease.property_id) : undefined;

  const slots = React.useMemo(buildSlots, []);

  const [category, setCategory] = React.useState<TicketCategory | null>(null);
  const [severity, setSeverity] = React.useState<Severity>('medium');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [availability, setAvailability] = React.useState<string[]>([slots[0]]);
  const [error, setError] = React.useState<string | null>(null);
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const categoryRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);

  const addPhoto = () =>
    setPhotos((prev) => [
      ...prev,
      `https://picsum.photos/seed/report-${Date.now()}-${prev.length}/900/700`,
    ]);

  const submit = () => {
    if (!category) {
      setError(t.tenant.report.missingCategory);
      categoryRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (!title.trim()) {
      setError(t.tenant.report.missingTitle);
      titleRef.current?.focus();
      titleRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setError(null);
    const id = createTicket({
      category,
      severity,
      title: title.trim(),
      description: description.trim(),
      photos,
      availability,
    });
    setCreatedId(id);
    pushToast(t.tenant.report.success, 'success');
  };

  /* ── Success state ─────────────────────────────────── */
  if (createdId) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center motion-safe:animate-[fade-up_240ms_var(--ease-out-quint)]">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-open-soft">
          <CheckCircle2 className="h-7 w-7 text-open" />
        </span>
        <h1 className="text-xl font-extrabold text-ink">{t.tenant.report.success}</h1>
        <p className="max-w-sm text-sm leading-6 text-muted">{t.tenant.report.successHint}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate('/tenant/tickets')}>{t.tenant.report.viewTicket}</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setCreatedId(null);
              setCategory(null);
              setTitle('');
              setDescription('');
              setPhotos([]);
              setSeverity('medium');
              setAvailability([slots[0]]);
            }}
          >
            {t.tenant.report.reportAnother}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.tenant.report.title}
        subtitle={
          property
            ? `${property.address.street} ${property.address.number} · ${t.tenant.report.subtitle}`
            : t.tenant.report.subtitle
        }
      />

      {/* Step 1 — category */}
      <section>
        <h2 className="mb-2.5 text-sm font-bold text-ink">{t.tenant.report.step1}</h2>
        <div ref={categoryRef} className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {CATEGORIES.map((option) => {
            const active = category === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setCategory(option.id);
                  setError(null);
                }}
                aria-pressed={active}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border text-center transition-colors duration-150',
                  active
                    ? 'border-ink bg-ink text-on-ink'
                    : 'border-line text-ink-soft hover:border-line-strong hover:bg-surface',
                )}
              >
                <option.Icon className="h-5 w-5" />
                <span className="px-1 text-2xs font-bold leading-3">{t.ticketCategory[option.id]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2 — severity */}
      <section>
        <h2 className="mb-2.5 text-sm font-bold text-ink">{t.tenant.report.step2}</h2>
        <div className="flex gap-2">
          {SEVERITIES.map((s) => {
            const active = severity === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                aria-pressed={active}
                className={cn(
                  'flex-1 rounded-[var(--radius-card)] border p-3 text-start transition-colors duration-150',
                  active
                    ? s === 'urgent'
                      ? 'border-alert bg-alert text-white'
                      : 'border-ink bg-ink text-on-ink'
                    : 'border-line hover:border-line-strong hover:bg-surface',
                )}
              >
                <span className={cn('block text-sm font-bold', !active && 'text-ink')}>
                  {t.severity[s]}
                </span>
                <span
                  className={cn(
                    'mt-0.5 block text-2xs leading-4',
                    active ? 'opacity-80' : 'text-muted',
                  )}
                >
                  {t.tenant.report.severityHint[s]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Details */}
      <section className="space-y-4">
        <Field label={t.tenant.report.titleField} htmlFor="ticket-title">
          <Input
            id="ticket-title"
            ref={titleRef}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            placeholder={t.tenant.report.titlePlaceholder}
          />
        </Field>

        <Field label={t.tenant.report.description} hint={t.ui.optional} htmlFor="ticket-desc">
          <Textarea
            id="ticket-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.tenant.report.descriptionPlaceholder}
          />
        </Field>

        {/* Photos */}
        <div>
          <p className="mb-1.5 text-xs font-bold text-ink-soft">{t.tenant.report.photos}</p>
          <div className="flex flex-wrap items-center gap-2">
            {photos.map((src, i) => (
              <span key={src} className="relative">
                <img
                  src={src}
                  alt=""
                  className="h-20 w-20 rounded-[var(--radius-control)] border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={t.ui.delete}
                  className="absolute -top-1.5 -end-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-on-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={addPhoto}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border border-dashed border-line text-muted transition-colors duration-150 hover:border-line-strong hover:text-ink"
            >
              <Camera className="h-5 w-5" />
              <span className="text-2xs font-bold">{t.tenant.report.addPhoto}</span>
            </button>
          </div>
          <p className="mt-1.5 text-2xs text-muted">{t.tenant.report.photoHint}</p>
        </div>
      </section>

      {/* Step 3 — availability */}
      <section>
        <h2 className="mb-1 text-sm font-bold text-ink">{t.tenant.report.step3}</h2>
        <p className="mb-2.5 text-2xs text-muted">{t.tenant.report.availabilityHint}</p>
        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => {
            const active = availability.includes(slot);
            return (
              <button
                key={slot}
                type="button"
                onClick={() =>
                  setAvailability((prev) =>
                    prev.includes(slot) ? prev.filter((x) => x !== slot) : [...prev, slot],
                  )
                }
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-3 py-2 text-2xs font-semibold transition-colors duration-150',
                  active
                    ? 'border-ink bg-ink text-on-ink'
                    : 'border-line text-ink-soft hover:border-line-strong',
                )}
              >
                <Num board>
                  {formatWeekdayDate(slot)} · {formatTime(slot)}
                </Num>
              </button>
            );
          })}
        </div>
      </section>

      {/* Solid action bar — content scrolls behind it rather than under a
          floating button that hides the field it overlaps. The error lives in
          here too: an error rendered in normal flow sits below the fold, so
          submitting looks like nothing happened. */}
      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] border border-alert/30 bg-alert-soft px-3.5 py-2 text-xs font-semibold text-alert"
          >
            {error}
          </p>
        ) : null}
        <Button size="lg" className="w-full" onClick={submit}>
          {t.tenant.report.submit}
        </Button>
      </div>
    </div>
  );
}
