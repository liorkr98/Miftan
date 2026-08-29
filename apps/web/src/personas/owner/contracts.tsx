import * as React from 'react';
import { useStore, useStoreShallow } from '@/data/store';
import { t, formatDate, type ContractScan } from '@miftach/shared';
import { Money, Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { OfferRail, RevenueMarker } from '@/components/shared/revenue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Check,
  FileSignature,
  FileText,
  ScanLine,
  Sparkles,
  Upload,
} from 'lucide-react';

const SCAN_STEPS = [
  t.contracts.scanStep.upload,
  t.contracts.scanStep.read,
  t.contracts.scanStep.extract,
  t.contracts.scanStep.review,
];

export function OwnerContracts() {
  const { properties, leads, seekers, contractScans } = useStoreShallow((s) => ({
    properties: s.properties,
    leads: s.leads,
    seekers: s.seekers,
    contractScans: s.contractScans,
  }));
  const startScan = useStore((s) => s.startContractScan);
  const advanceScan = useStore((s) => s.advanceContractScan);
  const generateContract = useStore((s) => s.generateContract);

  const [unitId, setUnitId] = React.useState(properties[0]?.id ?? '');
  const [activeScanId, setActiveScanId] = React.useState<string | null>(null);

  const active = contractScans.find((x) => x.id === activeScanId);
  const history = contractScans.filter((x) => x.status === 'committed');

  /* Drive the mock pipeline forward on a timer so the review step is reached
     the way it would be in a real one — asynchronously, with visible stages. */
  React.useEffect(() => {
    if (!active) return;
    if (active.status === 'uploading') {
      const id = window.setTimeout(() => advanceScan(active.id), 700);
      return () => window.clearTimeout(id);
    }
    if (active.status === 'scanning') {
      const id = window.setTimeout(() => advanceScan(active.id), 1600);
      return () => window.clearTimeout(id);
    }
  }, [active, advanceScan]);

  const upload = () => {
    if (!unitId) return;
    const property = properties.find((p) => p.id === unitId);
    const name = t.contracts.fileNamePattern
      .replace('{street}', property?.address.street ?? '')
      .replace('{number}', property?.address.number ?? '');
    setActiveScanId(startScan(unitId, name));
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t.contracts.title} subtitle={t.contracts.subtitle} />

      <Tabs defaultValue="scan">
        <TabsList>
          <TabsTrigger value="scan">{t.contracts.upload}</TabsTrigger>
          <TabsTrigger value="generate">{t.contracts.generator}</TabsTrigger>
          <TabsTrigger value="history">
            {t.contracts.history}
            {history.length ? <Num className="ms-1.5 text-2xs text-muted">{history.length}</Num> : null}
          </TabsTrigger>
        </TabsList>

        {/* ── Upload + scan ─────────────────────────────── */}
        <TabsContent value="scan" className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
            <section className="space-y-4">
              <Field label={t.contracts.pickUnit}>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address.street} {p.address.number} · {p.address.neighborhood}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <button
                type="button"
                onClick={upload}
                disabled={Boolean(active && active.status !== 'committed' && active.status !== 'review')}
                className={cn(
                  'press flex w-full flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line px-4 py-10',
                  'transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out)]',
                  'hover:border-line-strong hover:bg-surface disabled:pointer-events-none disabled:opacity-50',
                )}
              >
                <Upload className="h-6 w-6 text-line-strong" />
                <span className="text-sm font-bold text-ink">{t.contracts.dropHere}</span>
                <span className="text-2xs text-muted">{t.contracts.uploadHint}</span>
              </button>

              <p className="flex items-start gap-1.5 rounded-[var(--radius-control)] bg-surface p-3 text-2xs leading-5 text-muted">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t.contracts.aiNote}
              </p>
            </section>

            <section>
              {!active ? (
                <EmptyState
                  icon={ScanLine}
                  title={t.contracts.upload}
                  hint={t.contracts.uploadHint}
                  className="h-full"
                />
              ) : (
                <ScanPanel scan={active} onReset={() => setActiveScanId(null)} />
              )}
            </section>
          </div>
        </TabsContent>

        {/* ── Generator ─────────────────────────────────── */}
        <TabsContent value="generate" className="space-y-5">
          <ContractGenerator
            properties={properties}
            leads={leads}
            seekers={seekers}
            onGenerate={generateContract}
          />
          <OfferRail placement="lease" audience="owner" />
        </TabsContent>

        {/* ── History ───────────────────────────────────── */}
        <TabsContent value="history">
          {history.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t.contracts.noHistory}
              hint={t.contracts.noHistoryHint}
            />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
              {history.map((scan) => {
                const property = properties.find((p) => p.id === scan.property_id);
                return (
                  <li key={scan.id} className="flex items-center gap-3 p-3.5">
                    <FileText className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{scan.file_name}</span>
                      <span className="block text-2xs text-muted">
                        {property ? `${property.address.street} ${property.address.number}` : ''} ·{' '}
                        <Num board>{formatDate(scan.uploaded_at)}</Num>
                      </span>
                    </span>
                    <Badge tone="openSoft" size="sm">
                      {t.contracts.committed}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── The scan pipeline ─────────────────────────────────── */

function ScanPanel({ scan, onReset }: { scan: ContractScan; onReset: () => void }) {
  const setScanField = useStore((s) => s.setScanField);
  const commit = useStore((s) => s.commitContractScan);
  const pushToast = useStore((s) => s.pushToast);

  const stage = scan.status === 'uploading' ? 0 : scan.status === 'scanning' ? 2 : 3;
  const busy = scan.status === 'uploading' || scan.status === 'scanning';
  const lowConfidence = scan.fields.filter((f) => f.confidence < 0.8).length;

  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          <FileText className="h-4 w-4 text-muted" />
          {scan.file_name}
        </span>
        {scan.status === 'committed' ? (
          <Badge tone="openSoft" size="sm">
            <Check className="h-3 w-3" strokeWidth={3} />
            {t.contracts.committed}
          </Badge>
        ) : null}
      </div>

      {/* Stage rail */}
      <ol className="mb-4 flex items-center gap-1.5">
        {SCAN_STEPS.map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 ? (
              <span
                className={cn('h-px flex-1 transition-colors duration-300', i <= stage ? 'bg-ink' : 'bg-line')}
                aria-hidden
              />
            ) : null}
            <li
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors duration-300',
                i < stage
                  ? 'bg-ink text-on-ink'
                  : i === stage
                    ? 'bg-signal text-ink'
                    : 'bg-surface-sunk text-muted',
              )}
            >
              {label}
            </li>
          </React.Fragment>
        ))}
      </ol>

      {busy ? (
        /* A document with a sweeping scan line reads as "reading this",
           where a spinner would only read as "waiting". */
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="relative h-28 w-20 overflow-hidden rounded-[6px] border border-line bg-surface">
            <div className="space-y-1.5 p-2.5">
              {[10, 8, 11, 6, 9, 7, 10].map((w, i) => (
                <span key={i} className="block h-1 rounded-full bg-line-strong" style={{ width: `${w * 8}%` }} />
              ))}
            </div>
            <span
              className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent via-signal/60 to-transparent motion-safe:animate-[scan-sweep_1.4s_var(--ease-in-out)_infinite] motion-reduce:hidden"
              aria-hidden
            />
          </div>
          <p className="text-sm font-bold text-ink">{t.contracts.scanning}</p>
          <p className="max-w-xs text-center text-2xs leading-4 text-muted">
            {t.contracts.scanningHint}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-ink">{t.contracts.review}</h3>
              <p className="text-2xs text-muted">{t.contracts.reviewHint}</p>
            </div>
            {lowConfidence > 0 ? (
              <Badge tone="signalSoft" size="sm">
                <AlertTriangle className="h-3 w-3" />
                <Num board>{lowConfidence}</Num> {t.contracts.lowConfidence}
              </Badge>
            ) : null}
          </div>

          <ul className="stagger space-y-2">
            {scan.fields.map((field) => {
              const low = field.confidence < 0.8;
              return (
                <li
                  key={field.key}
                  className={cn(
                    'rounded-[var(--radius-control)] border p-2.5 transition-colors duration-200',
                    low ? 'border-signal/60 bg-signal-soft/50' : 'border-line',
                  )}
                >
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-2xs font-bold text-ink-soft">{field.label}</span>
                    <span className="flex items-center gap-1.5 text-2xs text-muted">
                      {t.contracts.confidence}
                      <Num board className={cn('font-bold', low ? 'text-signal-deep' : 'text-ink')}>
                        {Math.round(field.confidence * 100)}%
                      </Num>
                    </span>
                  </div>
                  <Input
                    value={field.value}
                    disabled={scan.status === 'committed'}
                    onChange={(e) => setScanField(scan.id, field.key, e.target.value)}
                    aria-label={field.label}
                  />
                  <p className="mt-1 text-2xs text-muted">
                    {t.contracts.sourceHint}: {field.source_hint}
                  </p>
                </li>
              );
            })}
          </ul>

          {scan.missing.length > 0 ? (
            <div className="mt-3 rounded-[var(--radius-control)] bg-surface p-3">
              <p className="mb-1 text-2xs font-bold text-ink-soft">{t.contracts.missing}</p>
              <ul className="space-y-0.5">
                {scan.missing.map((m) => (
                  <li key={m} className="text-2xs text-muted">
                    · {m}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-2xs text-muted">{t.contracts.missingHint}</p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {scan.status === 'committed' ? (
              <Button variant="secondary" onClick={onReset}>
                {t.contracts.scanAgain}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => {
                    commit(scan.id);
                    pushToast(t.contracts.committed, 'success');
                  }}
                >
                  <Check className="h-4 w-4" />
                  {t.contracts.commit}
                </Button>
                <Button variant="ghost" onClick={onReset}>
                  {t.ui.cancel}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Generator ─────────────────────────────────────────── */

function ContractGenerator({
  properties,
  leads,
  seekers,
  onGenerate,
}: {
  properties: ReturnType<typeof useStore.getState>['properties'];
  leads: ReturnType<typeof useStore.getState>['leads'];
  seekers: ReturnType<typeof useStore.getState>['seekers'];
  onGenerate: (propertyId: string, leadId?: string) => void;
}) {
  const [unitId, setUnitId] = React.useState(properties[0]?.id ?? '');
  const [leadId, setLeadId] = React.useState('none');

  const property = properties.find((p) => p.id === unitId);
  const unitLeads = leads.filter((l) => l.property_id === unitId);

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <section className="space-y-4">
        <Field label={t.contracts.pickUnit}>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.address.street} {p.address.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t.contracts.pickLead}>
          <Select value={leadId} onValueChange={setLeadId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t.contracts.noLead}</SelectItem>
              {unitLeads.map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  {seekers.find((x) => x.id === lead.seeker_id)?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <p className="text-2xs leading-5 text-muted">{t.contracts.generatorHint}</p>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle>{t.contracts.terms}</SectionTitle>
        {property ? (
          <dl className="space-y-2 text-sm">
            <Row label={t.properties.address} value={`${property.address.street} ${property.address.number}`} />
            <Row label={t.unit.lease.monthlyRent} value={<Money value={property.monthly_rent} board />} />
            <Row label={t.unit.lease.deposit} value={<Money value={property.monthly_rent * 2} board />} />
            <Row label={t.unit.arnona} value={<Money value={property.arnona_bimonthly} board />} />
            <Row label={t.unit.vaad} value={<Money value={property.vaad_monthly} board />} />
            <Row
              label={t.contracts.pickLead}
              value={
                leadId === 'none'
                  ? t.contracts.noLead
                  : seekers.find(
                      (x) => x.id === leads.find((l) => l.id === leadId)?.seeker_id,
                    )?.name ?? '—'
              }
            />
          </dl>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => onGenerate(unitId, leadId === 'none' ? undefined : leadId)}>
            <FileSignature className="h-4 w-4" />
            {t.contracts.generate}
          </Button>
          <RevenueMarker streamId="rs-doc" />
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
