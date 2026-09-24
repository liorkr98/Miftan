import * as React from 'react';
import { useStore } from '@/data/store';
import {
  t,
  formatDate,
  type ContractScanView,
  type OwnerProperty,
  type RenderedContract,
} from '@miftan/shared';
import {
  useCommitScan,
  useContractScans,
  useContractTemplates,
  useDeleteTemplate,
  useProperties,
  useRenderTemplate,
  useSaveTemplate,
  useScanContract,
} from '@/api/hooks';
import { Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
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
  Trash2,
  Upload,
} from 'lucide-react';

const SCAN_STEPS = [
  t.contracts.scanStep.upload,
  t.contracts.scanStep.read,
  t.contracts.scanStep.extract,
  t.contracts.scanStep.review,
];

function parseShekels(raw: string): number | undefined {
  const n = Number(raw.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseIntish(raw: string): number | undefined {
  const n = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

export function OwnerContracts() {
  const { data: scans = [], isLoading, isError, refetch } = useContractScans();
  const { data: properties = [] } = useProperties();
  const scanContract = useScanContract();
  const fileInput = React.useRef<HTMLInputElement>(null);

  const owned = properties.filter((p): p is OwnerProperty => p.scope === 'owner');
  const [unitId, setUnitId] = React.useState('');
  const [activeScanId, setActiveScanId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!unitId && owned[0]) setUnitId(owned[0].id);
  }, [owned, unitId]);

  const active = scans.find((x) => x.id === activeScanId);
  const history = scans.filter((x) => x.status === 'committed');

  const upload = async (file: File) => {
    if (!unitId) return;
    const property = owned.find((p) => p.id === unitId);
    const name =
      file.name ||
      t.contracts.fileNamePattern
        .replace('{street}', property?.address.street ?? '')
        .replace('{number}', property?.address.number ?? '');
    const text = await file.text();
    scanContract.mutate(
      { propertyId: unitId, fileName: name, text },
      { onSuccess: (scan) => setActiveScanId(scan.id) },
    );
  };

  if (isError) return <ErrorState onRetry={() => void refetch()} />;

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

        <TabsContent value="scan" className="space-y-5">
          {isLoading ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
              <section className="space-y-4">
                <Field label={t.contracts.pickUnit}>
                  <Select value={unitId} onValueChange={setUnitId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {owned.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.address.street} {p.address.number} · {p.address.neighborhood}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <input
                  ref={fileInput}
                  type="file"
                  accept=".txt,.pdf,.png,.jpg,.jpeg"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={scanContract.isPending}
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
                {scanContract.isPending ? (
                  <ScanningPanel />
                ) : !active ? (
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
          )}
          <OfferRail placement="contract_review" audience="owner" title={t.offers.sectionLegal} />
        </TabsContent>

        <TabsContent value="generate" className="space-y-5">
          <ContractGenerator owned={owned} />
          <OfferRail placement="contract_review" audience="owner" title={t.offers.sectionLegal} />
          <OfferRail placement="lease" audience="owner" />
        </TabsContent>

        <TabsContent value="history">
          {history.length === 0 ? (
            <EmptyState icon={FileText} title={t.contracts.noHistory} hint={t.contracts.noHistoryHint} />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
              {history.map((scan) => (
                <li key={scan.id} className="flex items-center gap-3 p-3.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{scan.fileName}</span>
                    <span className="block text-2xs text-muted">
                      {scan.propertyLabel} · <Num board>{formatDate(scan.uploadedAt)}</Num>
                    </span>
                  </span>
                  <Badge tone="openSoft" size="sm">
                    {t.contracts.committed}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScanningPanel() {
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <ol className="mb-4 flex items-center gap-1.5">
        {SCAN_STEPS.map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 ? <span className={cn('h-px flex-1', i <= 2 ? 'bg-ink' : 'bg-line')} aria-hidden /> : null}
            <li
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold',
                i < 2 ? 'bg-ink text-on-ink' : i === 2 ? 'bg-signal text-ink' : 'bg-surface-sunk text-muted',
              )}
            >
              {label}
            </li>
          </React.Fragment>
        ))}
      </ol>
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
        <p className="max-w-xs text-center text-2xs leading-4 text-muted">{t.contracts.scanningHint}</p>
      </div>
    </div>
  );
}

function ScanPanel({ scan, onReset }: { scan: ContractScanView; onReset: () => void }) {
  const commit = useCommitScan();
  const pushToast = useStore((s) => s.pushToast);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(scan.fields.map((f) => [f.key, f.value])),
  );

  React.useEffect(() => {
    setValues(Object.fromEntries(scan.fields.map((f) => [f.key, f.value])));
  }, [scan.id, scan.fields]);

  const stage = scan.status === 'committed' ? 3 : 3;
  const lowConfidence = scan.fields.filter((f) => f.needsReview).length;

  return (
    <div className="rounded-[var(--radius-card)] border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          <FileText className="h-4 w-4 text-muted" />
          {scan.fileName}
        </span>
        {scan.status === 'committed' ? (
          <Badge tone="openSoft" size="sm">
            <Check className="h-3 w-3" strokeWidth={3} />
            {t.contracts.committed}
          </Badge>
        ) : scan.status === 'failed' ? (
          <Badge tone="alertSoft" size="sm">
            {t.contracts.failed}
          </Badge>
        ) : null}
      </div>

      <ol className="mb-4 flex items-center gap-1.5">
        {SCAN_STEPS.map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 ? (
              <span className={cn('h-px flex-1', i <= stage ? 'bg-ink' : 'bg-line')} aria-hidden />
            ) : null}
            <li
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold',
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

      {scan.status === 'failed' ? (
        <EmptyState icon={AlertTriangle} title={t.contracts.failed} hint={t.contracts.failedHint} />
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
              const low = field.needsReview;
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
                    value={values[field.key] ?? ''}
                    disabled={scan.status === 'committed'}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    aria-label={field.label}
                  />
                  <p className="mt-1 text-2xs text-muted">
                    {t.contracts.sourceHint}: {field.sourceHint}
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
                  loading={commit.isPending}
                  onClick={() =>
                    commit.mutate(
                      {
                        id: scan.id,
                        monthlyRent: parseShekels(values.monthlyRent ?? ''),
                        deposit: parseShekels(values.deposit ?? ''),
                        startDate: values.startDate || undefined,
                        endDate: values.endDate || undefined,
                        noticePeriodDays: parseIntish(values.noticePeriodDays ?? ''),
                        extensionMonths: parseIntish(values.extensionMonths ?? ''),
                      },
                      { onSuccess: () => pushToast(t.contracts.committed, 'success') },
                    )
                  }
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

function ContractGenerator({ owned }: { owned: OwnerProperty[] }) {
  const { data, isLoading, isError, refetch } = useContractTemplates();
  const render = useRenderTemplate();
  const save = useSaveTemplate();
  const remove = useDeleteTemplate();
  const pushToast = useStore((s) => s.pushToast);

  const templates = data?.templates ?? [];
  const [templateId, setTemplateId] = React.useState('');
  const [leaseId, setLeaseId] = React.useState('none');
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [rendered, setRendered] = React.useState<RenderedContract | null>(null);

  const template = templates.find((tpl) => tpl.id === templateId) ?? templates[0];
  const leases = owned.flatMap((p) =>
    p.lease
      ? [{ id: p.lease.id, label: `${p.address.street} ${p.address.number} · ${p.tenant?.name ?? ''}` }]
      : [],
  );

  React.useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id);
  }, [templates, templateId]);

  React.useEffect(() => {
    setValues({});
    setRendered(null);
  }, [templateId, leaseId]);

  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading) return <ListSkeleton rows={4} />;
  if (!template) {
    return <EmptyState icon={FileSignature} title={t.contracts.templates} />;
  }

  const cloneBuiltIn = () => {
    save.mutate(
      {
        basedOn: template.isBuiltIn ? template.id : template.basedOn ?? template.id,
        name: template.name,
        description: template.description,
        useWhen: template.useWhen,
        body: template.body,
        variables: template.variables,
      },
      { onSuccess: (copy) => setTemplateId(copy.id) },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <section className="space-y-4">
        <Field label={t.contracts.pickTemplate}>
          <Select
            value={template.id}
            onValueChange={(id) => {
              setTemplateId(id);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="rounded-[var(--radius-control)] bg-surface p-3">
          <p className="text-xs font-bold text-ink">{template.name}</p>
          <p className="mt-1 text-2xs leading-5 text-muted">{template.description}</p>
          <p className="mt-1.5 text-2xs text-ink-soft">
            {t.contracts.useWhen}: {template.useWhen}
          </p>
          <Badge tone="outline" size="sm" className="mt-2">
            {template.isBuiltIn ? t.contracts.builtIn : t.contracts.yourCopy}
          </Badge>
        </div>

        <Field label={t.contracts.pickLease}>
          <Select value={leaseId} onValueChange={setLeaseId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t.contracts.noLease}</SelectItem>
              {leases.map((lease) => (
                <SelectItem key={lease.id} value={lease.id}>
                  {lease.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {template.variables
          .filter((v) => v.required)
          .map((variable) => (
            <Field key={variable.key} label={variable.label} hint={variable.hint ?? undefined} htmlFor={variable.key}>
              <Input
                id={variable.key}
                value={values[variable.key] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [variable.key]: e.target.value }))}
              />
            </Field>
          ))}

        <div className="flex flex-wrap gap-2">
          <Button
            loading={render.isPending}
            onClick={() =>
              render.mutate(
                {
                  id: template.id,
                  leaseId: leaseId === 'none' ? undefined : leaseId,
                  values,
                },
                { onSuccess: setRendered },
              )
            }
          >
            <FileSignature className="h-4 w-4" />
            {t.contracts.render}
          </Button>
          {template.isBuiltIn ? (
            <Button variant="secondary" loading={save.isPending} onClick={cloneBuiltIn}>
              {t.contracts.clone}
            </Button>
          ) : (
            <Button
              variant="ghost"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(template.id, {
                  onSuccess: () => {
                    setTemplateId('');
                    pushToast(t.ui.delete);
                  },
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t.contracts.deleteClone}
            </Button>
          )}
        </div>
        <p className="text-2xs leading-5 text-muted">{t.contracts.generatorHint}</p>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <SectionTitle>{t.contracts.terms}</SectionTitle>
        {!rendered ? (
          <EmptyState
            icon={FileText}
            title={t.contracts.generator}
            hint={t.contracts.generatorHint}
            compact
          />
        ) : (
          <>
            {rendered.missing.length ? (
              <p className="mb-3 rounded-[var(--radius-control)] bg-signal-soft px-3 py-2 text-2xs text-signal-deep">
                {t.contracts.missingFields}: {rendered.missing.join(' · ')}
              </p>
            ) : null}
            {rendered.prefilled.length ? (
              <p className="mb-3 text-2xs text-muted">
                {t.contracts.prefilledFrom}: {rendered.prefilled.join(' · ')}
              </p>
            ) : null}
            <pre className="max-h-[40rem] overflow-auto whitespace-pre-wrap rounded-[var(--radius-control)] bg-surface p-4 text-sm leading-7 text-ink">
              {rendered.text}
            </pre>
            <RevenueMarker streamId="rs-doc" className="mt-3" />
          </>
        )}
      </section>
    </div>
  );
}
