import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t, formatAge, formatDate, formatUntil, daysUntil, type LeadStage } from '@miftach/shared';
import { leadsForProperty, scoreLeads, type ScoredLead } from '@/data/selectors';
import { Money, Num, PageHeader, Phone } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { AvailabilityChip, LeadStageBadge } from '@/components/shared/status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Meter } from '@/components/shared/meter';
import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/field';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ListSkeleton } from '@/components/shared/skeleton';
import { RevenueMarker } from '@/components/shared/revenue';
import { useDelayedReady } from '@/lib/use-delayed-ready';
import { availabilityKind, leaseForProperty } from '@/data/selectors';
import { cn } from '@/lib/utils';
import { Check, ListFilter, SlidersHorizontal, Users, X } from 'lucide-react';

const STAGES: LeadStage[] = [
  'new',
  'screening',
  'viewing_scheduled',
  'viewed',
  'offer',
  'signed',
  'rejected',
];

type View = 'board' | 'byUnit';

export function OwnerCrm() {
  const navigate = useNavigate();
  const ready = useDelayedReady();
  const [params, setParams] = useSearchParams();
  const { leads, properties, seekers, leases, screeningPresets } = useStoreShallow((s) => ({
    leads: s.leads,
    properties: s.properties,
    seekers: s.seekers,
    leases: s.leases,
    screeningPresets: s.screeningPresets,
  }));

  const [view, setView] = React.useState<View>('board');
  const [unitFilter, setUnitFilter] = React.useState('all');

  const preset = screeningPresets.find((p) => p.is_active);
  const scored = React.useMemo(() => scoreLeads(leads, preset), [leads, preset]);
  const propertyById = React.useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const seekerById = React.useMemo(() => new Map(seekers.map((s) => [s.id, s])), [seekers]);

  const visible = React.useMemo(
    () => (unitFilter === 'all' ? scored : scored.filter((l) => l.property_id === unitFilter)),
    [scored, unitFilter],
  );

  const openId = params.get('lead');
  const openLead = scored.find((l) => l.id === openId);

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('lead', id);
    else next.delete('lead');
    setParams(next, { replace: true });
  };

  /* Units that have a queue, sorted by how soon they free up. */
  const queuedUnits = React.useMemo(
    () =>
      properties
        .filter((p) => leads.some((l) => l.property_id === p.id))
        .sort((a, b) => (a.available_from ?? '9999').localeCompare(b.available_from ?? '9999')),
    [properties, leads],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.crm.title}
        subtitle={t.crm.subtitle}
        actions={
          <>
            <div className="flex items-center gap-0.5 rounded-[var(--radius-control)] border border-line p-0.5">
              {(
                [
                  ['board', t.crm.board],
                  ['byUnit', t.crm.byUnit],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-pressed={view === id}
                  className={cn(
                    'rounded-[7px] px-2.5 py-1.5 text-xs font-bold transition-colors duration-150',
                    view === id ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={() => navigate('/owner/crm/filters')}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t.screening.title}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t.properties.address} className="w-72">
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.crm.allUnits}</SelectItem>
              {queuedUnits.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.address.street} {p.address.number} · {p.address.neighborhood}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <span className="pb-2.5 text-xs text-muted">
          <Num board className="font-bold text-ink">
            {visible.length}
          </Num>{' '}
          {t.crm.inQueue}
        </span>
        {preset ? (
          <Badge tone="outline" size="sm" className="mb-2">
            <ListFilter className="h-3 w-3" />
            {preset.name}
          </Badge>
        ) : null}
      </div>

      {!ready ? (
        <ListSkeleton rows={6} />
      ) : view === 'board' ? (
        <div className="hide-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {STAGES.map((stage) => {
            const column = visible
              .filter((l) => l.stage === stage)
              .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at));
            return (
              <section
                key={stage}
                className="flex w-[16rem] shrink-0 flex-col rounded-[var(--radius-card)] border border-line bg-surface"
              >
                <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <h2 className="text-xs font-bold text-ink">{t.leadStage[stage]}</h2>
                  <Num board className="text-2xs font-bold text-muted">
                    {column.length}
                  </Num>
                </header>
                <div className="flex flex-1 flex-col gap-2 p-2 pt-0">
                  {column.length === 0 ? (
                    <p className="rounded-[var(--radius-control)] border border-dashed border-line py-6 text-center text-2xs text-muted">
                      {t.tickets.emptyColumn}
                    </p>
                  ) : (
                    column.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        seekerName={seekerById.get(lead.seeker_id)?.name ?? ''}
                        unitLabel={
                          propertyById.get(lead.property_id)
                            ? `${propertyById.get(lead.property_id)!.address.street} ${propertyById.get(lead.property_id)!.address.number}`
                            : ''
                        }
                        onClick={() => setOpen(lead.id)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* By-unit view: the queue on each apartment, occupied ones included */
        <div className="space-y-4">
          {queuedUnits.length === 0 ? (
            <EmptyState icon={Users} title={t.crm.empty} hint={t.crm.emptyHint} />
          ) : (
            queuedUnits
              .filter((p) => unitFilter === 'all' || p.id === unitFilter)
              .map((property) => {
                const queue = leadsForProperty(leads, property.id);
                const lease = leaseForProperty(leases, property.id);
                const kind = availabilityKind(property, lease);
                return (
                  <section
                    key={property.id}
                    className="overflow-hidden rounded-[var(--radius-card)] border border-line"
                  >
                    <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/owner/properties/${property.id}`)}
                        className="text-sm font-bold text-ink underline-offset-2 hover:underline"
                      >
                        {property.address.street} {property.address.number}
                      </button>
                      <span className="text-2xs text-muted">{property.address.neighborhood}</span>
                      <AvailabilityChip kind={kind} date={property.available_from}
              confidence={property.availability_confidence} size="sm" />
                      <span className="ms-auto text-2xs text-muted">
                        <Num board className="font-bold text-ink">
                          {queue.length}
                        </Num>{' '}
                        {t.crm.leadsOnUnit}
                      </span>
                    </header>
                    <ul className="divide-y divide-line">
                      {queue.map((lead) => {
                        const s = scored.find((x) => x.id === lead.id)!;
                        return (
                          <li key={lead.id}>
                            <button
                              type="button"
                              onClick={() => setOpen(lead.id)}
                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-start transition-colors duration-150 hover:bg-surface"
                            >
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-sunk">
                                <Num board className="text-2xs font-bold text-ink-soft">
                                  {lead.queue_position}
                                </Num>
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold text-ink">
                                  {seekerById.get(lead.seeker_id)?.name}
                                </span>
                                <span className="block truncate text-2xs text-muted">
                                  {t.crm.moveIn} {formatDate(lead.desired_move_in)} ·{' '}
                                  {t.crm.waitingDays} <Num board>{Math.abs(daysUntil(lead.created_at))}</Num>
                                </span>
                              </span>
                              <span className="hidden w-24 shrink-0 sm:block">
                                <Meter
                                  value={s.score}
                                  max={100}
                                  tone={s.score >= 70 ? 'ink' : s.score >= 45 ? 'signal' : 'alert'}
                                  label={t.crm.score}
                                />
                              </span>
                              <LeadStageBadge stage={lead.stage} size="sm" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
          )}
        </div>
      )}

      <LeadDrawer lead={openLead} onClose={() => setOpen(null)} />
    </div>
  );
}

function LeadCard({
  lead,
  seekerName,
  unitLabel,
  onClick,
}: {
  lead: ScoredLead;
  seekerName: string;
  unitLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[var(--radius-control)] border border-line bg-bg p-2.5 text-start transition-colors duration-150 hover:border-line-strong"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold text-ink">{seekerName}</span>
          <span className="block truncate text-2xs text-muted">{unitLabel}</span>
        </span>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-sunk">
          <Num board className="text-[10px] font-bold text-ink-soft">
            {lead.queue_position}
          </Num>
        </span>
      </span>

      <span className="mt-2 block">
        <Meter
          value={lead.score}
          max={100}
          tone={lead.score >= 70 ? 'ink' : lead.score >= 45 ? 'signal' : 'alert'}
          label={t.crm.score}
        />
      </span>

      <span className="mt-1.5 flex items-center justify-between gap-2 text-2xs text-muted">
        <span>
          {t.crm.moveIn} <Num board>{formatDate(lead.desired_move_in)}</Num>
        </span>
        {lead.failedFlags > 0 ? (
          <span className="font-semibold text-signal-deep">
            <Num board>{lead.failedFlags}</Num> {t.crm.flagsFailed}
          </span>
        ) : (
          <span className="font-semibold text-open">{t.crm.flagsPassed}</span>
        )}
      </span>
    </button>
  );
}

/* ── Lead detail ───────────────────────────────────────── */

function LeadDrawer({ lead, onClose }: { lead?: ScoredLead; onClose: () => void }) {
  const { properties, seekers } = useStoreShallow((s) => ({
    properties: s.properties,
    seekers: s.seekers,
  }));
  const setLeadStage = useStore((s) => s.setLeadStage);
  const pushToast = useStore((s) => s.pushToast);
  const navigate = useNavigate();

  if (!lead) return null;

  const seeker = seekers.find((x) => x.id === lead.seeker_id);
  const property = properties.find((p) => p.id === lead.property_id);
  const employment = (t.seeker.profile.employmentOptions as Record<string, string>)[
    lead.screening.employment
  ];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <LeadStageBadge stage={lead.stage} size="sm" />
            <Badge tone="outline" size="sm">
              {t.crm.queuePosition} <Num board>{lead.queue_position}</Num>
            </Badge>
            {lead.watch_only ? (
              <Badge tone="neutral" size="sm">
                {t.seeker.queue.watchingOnly}
              </Badge>
            ) : null}
          </div>
          <DialogTitle className="mt-1.5">{seeker?.name}</DialogTitle>
          <p className="mt-0.5 text-xs text-muted">
            {property ? `${property.address.street} ${property.address.number}` : ''} ·{' '}
            {t.seeker.queue.waitingSince} {formatAge(lead.created_at)}
          </p>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-[var(--radius-control)] bg-surface p-3">
              <p className="mb-2 text-2xs font-bold text-ink-soft">{t.crm.seekerProfile}</p>
              <dl className="space-y-1.5 text-2xs">
                <Line label={t.crm.employment} value={employment} />
                <Line
                  label={t.crm.incomeRatio}
                  value={<Num board>×{lead.screening.income_to_rent_ratio.toFixed(1)}</Num>}
                />
                <Line
                  label={t.crm.guarantors}
                  value={lead.screening.has_guarantors ? t.crm.hasGuarantors : t.crm.noGuarantors}
                />
                <Line label={t.crm.occupants} value={<Num board>{lead.screening.occupants}</Num>} />
                <Line
                  label={t.seeker.profile.leaseLength}
                  value={
                    <>
                      <Num board>{lead.screening.lease_length_months}</Num> {t.ui.months}
                    </>
                  }
                />
                <Line label={t.crm.moveIn} value={<Num board>{formatDate(lead.desired_move_in)}</Num>} />
                <Line label={t.amenity.pets_allowed} value={lead.screening.pets ? t.ui.yes : t.ui.no} />
                <Line
                  label={t.screening.criterion.smoking}
                  value={lead.screening.smoker ? t.ui.yes : t.ui.no}
                />
              </dl>
              {seeker?.about ? (
                <p className="mt-2.5 border-t border-line pt-2.5 text-2xs leading-5 text-ink-soft">
                  {seeker.about}
                </p>
              ) : null}
              {seeker ? (
                <div className="mt-2.5 flex items-center gap-3 border-t border-line pt-2.5">
                  <Phone value={seeker.phone} className="text-2xs text-muted" />
                </div>
              ) : null}
            </section>

            <section className="rounded-[var(--radius-control)] bg-surface p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-2xs font-bold text-ink-soft">{t.crm.whyRanked}</p>
                <Num board className="text-sm font-bold text-ink">
                  {lead.score}
                </Num>
              </div>
              <Meter
                value={lead.score}
                max={100}
                tone={lead.score >= 70 ? 'ink' : lead.score >= 45 ? 'signal' : 'alert'}
                className="mb-2.5"
                label={t.crm.score}
              />
              <ul className="space-y-1.5">
                {lead.screening_flags.map((flag) => (
                  <li key={flag.criterion} className="flex items-start gap-1.5 text-2xs leading-4">
                    {flag.passed ? (
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-open" strokeWidth={3} />
                    ) : (
                      <X className="mt-0.5 h-3 w-3 shrink-0 text-signal-deep" strokeWidth={3} />
                    )}
                    <span className={flag.passed ? 'text-muted' : 'text-ink-soft'}>
                      <span className="font-semibold">{t.screening.criterion[flag.criterion]}</span>
                      {' — '}
                      {flag.note}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 border-t border-line pt-2.5 text-2xs leading-4 text-muted">
                {t.screening.softNote}
              </p>
              <RevenueMarker streamId="rs-verify" className="mt-2" />
            </section>
          </div>

          {property ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/owner/properties/${property.id}`);
              }}
              className="flex w-full items-center gap-3 rounded-[var(--radius-control)] border border-line p-3 text-start transition-colors duration-150 hover:bg-surface"
            >
              <img
                src={property.photos[0]}
                alt=""
                loading="lazy"
                className="h-12 w-16 shrink-0 rounded-[6px] object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">
                  {property.address.street} {property.address.number}
                </span>
                <span className="block text-2xs text-muted">
                  {property.address.neighborhood} ·{' '}
                  {property.available_from ? formatUntil(property.available_from) : t.availability.unknown}
                </span>
              </span>
              <Money value={property.monthly_rent} board className="text-sm font-bold text-ink" />
            </button>
          ) : null}
        </DialogBody>

        <DialogFooter className="flex-wrap">
          <Field label={t.crm.moveTo} className="w-52">
            <Select
              value={lead.stage}
              onValueChange={(v) => {
                setLeadStage(lead.id, v as LeadStage);
                pushToast(`${t.leadStage[v as LeadStage]}`, 'success');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {t.leadStage[stage]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogClose asChild>
            <Button variant="ghost" className="mb-0.5">
              {t.shell.close}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-bold text-ink">{value}</dd>
    </div>
  );
}
