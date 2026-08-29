import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t, formatDateTime, type ScreeningCriterion, type ScreeningCriterionId } from '@miftach/shared';
import { Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input, Switch } from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ArrowRight, Check, Download, Scale, ScrollText, X } from 'lucide-react';

const WEIGHT_LABEL: Record<1 | 2 | 3, string> = {
  1: t.screening.weightLow,
  2: t.screening.weightMed,
  3: t.screening.weightHigh,
};

/** Criteria that carry a numeric threshold the owner can set. */
const THRESHOLD_UNIT: Partial<Record<ScreeningCriterionId, string>> = {
  income_to_rent: '×',
  lease_length: t.ui.months,
};

export function OwnerScreening() {
  const navigate = useNavigate();
  const { screeningPresets, auditLog, properties, seekers } = useStoreShallow((s) => ({
    screeningPresets: s.screeningPresets,
    auditLog: s.auditLog,
    properties: s.properties,
    seekers: s.seekers,
  }));
  const setActivePreset = useStore((s) => s.setActivePreset);
  const updatePresetCriteria = useStore((s) => s.updatePresetCriteria);
  const exportAudit = useStore((s) => s.exportAudit);
  const pushToast = useStore((s) => s.pushToast);

  const active = screeningPresets.find((p) => p.is_active) ?? screeningPresets[0];
  const propertyById = React.useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const patch = (id: ScreeningCriterionId, next: Partial<ScreeningCriterion>) => {
    updatePresetCriteria(
      active.id,
      active.criteria.map((c) => (c.id === id ? { ...c, ...next } : c)),
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <Button variant="quiet" size="sm" className="-ms-2 mb-1" onClick={() => navigate('/owner/crm')}>
          <ArrowRight className="h-3.5 w-3.5" />
          {t.crm.title}
        </Button>
        <PageHeader title={t.screening.title} subtitle={t.screening.subtitle} />
      </div>

      {/* Why the criteria are what they are — stated once, plainly */}
      <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-3.5">
        <Scale className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-ink">{t.screening.softNote}</p>
          <p className="text-2xs leading-5 text-muted">{t.screening.legalNote}</p>
        </div>
      </div>

      <Tabs defaultValue="criteria">
        <TabsList>
          <TabsTrigger value="criteria">{t.screening.criteria}</TabsTrigger>
          <TabsTrigger value="audit">
            {t.screening.audit.title}
            <Num className="ms-1.5 text-2xs text-muted">{auditLog.length}</Num>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="criteria" className="space-y-5">
          {/* Presets */}
          <section>
            <SectionTitle>{t.screening.presets}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {screeningPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setActivePreset(preset.id);
                    pushToast(`${t.screening.activePreset}: ${preset.name}`, 'success');
                  }}
                  aria-pressed={preset.is_active}
                  className={cn(
                    'rounded-[var(--radius-control)] border px-3.5 py-2.5 text-start transition-colors duration-150',
                    preset.is_active
                      ? 'border-ink bg-ink text-on-ink'
                      : 'border-line text-ink hover:border-line-strong',
                  )}
                >
                  <span className="block text-xs font-bold">{preset.name}</span>
                  <span
                    className={cn(
                      'mt-0.5 block text-2xs',
                      preset.is_active ? 'text-on-ink-muted' : 'text-muted',
                    )}
                  >
                    <Num board>{preset.criteria.filter((c) => c.enabled).length}</Num>{' '}
                    {t.screening.criteria}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Criteria list */}
          <section>
            <SectionTitle aside={<span className="text-2xs text-muted">{active.name}</span>}>
              {t.screening.criteria}
            </SectionTitle>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
              {active.criteria.map((criterion) => (
                <li
                  key={criterion.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-4 gap-y-2.5 p-3.5 transition-opacity duration-150',
                    !criterion.enabled && 'opacity-55',
                  )}
                >
                  <div className="min-w-52 flex-1">
                    <p className="text-sm font-bold text-ink">{t.screening.criterion[criterion.id]}</p>
                    <p className="mt-0.5 text-2xs leading-4 text-muted">
                      {t.screening.criterionHint[criterion.id]}
                    </p>
                  </div>

                  {THRESHOLD_UNIT[criterion.id] ? (
                    <label className="flex items-center gap-1.5 text-2xs text-muted">
                      <Input
                        type="number"
                        dir="ltr"
                        step={criterion.id === 'income_to_rent' ? '0.5' : '1'}
                        className="num h-8 w-20"
                        value={String(criterion.value ?? '')}
                        disabled={!criterion.enabled}
                        onChange={(e) => patch(criterion.id, { value: Number(e.target.value) })}
                        aria-label={t.screening.criterion[criterion.id]}
                      />
                      {THRESHOLD_UNIT[criterion.id]}
                    </label>
                  ) : null}

                  <div className="flex items-center gap-0.5 rounded-[var(--radius-control)] border border-line p-0.5">
                    {([1, 2, 3] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        disabled={!criterion.enabled}
                        onClick={() => patch(criterion.id, { weight: w })}
                        aria-pressed={criterion.weight === w}
                        className={cn(
                          'rounded-[7px] px-2.5 py-1 text-2xs font-bold transition-colors duration-150 disabled:cursor-not-allowed',
                          criterion.weight === w ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink',
                        )}
                      >
                        {WEIGHT_LABEL[w]}
                      </button>
                    ))}
                  </div>

                  <Switch
                    checked={criterion.enabled}
                    onCheckedChange={(v) => patch(criterion.id, { enabled: v })}
                    aria-label={`${t.screening.enabled} — ${t.screening.criterion[criterion.id]}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        {/* ── Audit log ────────────────────────────────── */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">{t.screening.audit.subtitle}</h2>
              <p className="mt-0.5 text-2xs text-muted">{t.screening.audit.exportHint}</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                exportAudit();
                pushToast(t.screening.audit.exported, 'success');
              }}
            >
              <Download className="h-3.5 w-3.5" />
              {t.screening.audit.export}
            </Button>
          </div>

          {auditLog.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={t.screening.audit.empty}
              hint={t.screening.audit.emptyHint}
            />
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
              <table className="w-full min-w-[46rem] border-collapse">
                <thead>
                  <tr className="border-b border-line bg-surface text-2xs text-muted">
                    <th className="p-3 text-start font-bold">{t.screening.audit.when}</th>
                    <th className="p-3 text-start font-bold">{t.screening.audit.lead}</th>
                    <th className="p-3 text-start font-bold">{t.properties.address}</th>
                    <th className="p-3 text-start font-bold">{t.screening.activePreset}</th>
                    <th className="p-3 text-start font-bold">{t.screening.audit.detail}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {auditLog.slice(0, 60).map((entry) => {
                    const property = propertyById.get(entry.property_id);
                    const failed = entry.flags.filter((f) => !f.passed);
                    const name =
                      entry.lead_name ||
                      seekers.find((s) => s.id === entry.lead_id)?.name ||
                      '—';
                    return (
                      <tr key={entry.id} className="align-top text-sm">
                        <td className="p-3">
                          <Num board className="text-2xs text-muted">
                            {formatDateTime(entry.at)}
                          </Num>
                        </td>
                        <td className="p-3 font-semibold text-ink">{name}</td>
                        <td className="p-3 text-2xs text-muted">
                          {property
                            ? `${property.address.street} ${property.address.number}`
                            : entry.property_id}
                        </td>
                        <td className="p-3 text-2xs text-ink-soft">{entry.preset_name}</td>
                        <td className="p-3">
                          <p className="text-2xs text-ink-soft">{entry.detail}</p>
                          {failed.length ? (
                            <ul className="mt-1 space-y-0.5">
                              {failed.map((flag) => (
                                <li
                                  key={flag.criterion}
                                  className="flex items-start gap-1 text-2xs text-muted"
                                >
                                  <X className="mt-0.5 h-2.5 w-2.5 shrink-0 text-signal-deep" strokeWidth={3} />
                                  {flag.note}
                                </li>
                              ))}
                            </ul>
                          ) : entry.flags.length ? (
                            <p className="mt-1 flex items-center gap-1 text-2xs text-open">
                              <Check className="h-2.5 w-2.5" strokeWidth={3} />
                              {t.crm.flagsPassed}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {auditLog.length > 60 ? (
                <p className="border-t border-line bg-surface p-3 text-center text-2xs text-muted">
                  <Num board>{auditLog.length - 60}</Num> {t.ui.more}
                </p>
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
