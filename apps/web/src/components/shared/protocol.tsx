import * as React from 'react';
import { useStore } from '@/data/store';
import {
  t,
  formatDate,
  formatDateTime,
  protocolItems,
  type ProtocolKind,
  type ProtocolRunView as ProtocolRun,
  type ProtocolSection,
} from '@miftan/shared';
import {
  uploadFile,
  useCompleteProtocol,
  useProperty,
  useProtocolComparison,
  useProtocols,
  useStartProtocol,
  useUpdateProtocolEntry,
} from '@/api/hooks';
import { Num, SectionTitle } from './typography';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { ListSkeleton } from './skeleton';
import { Meter } from './meter';
import { OfferRail } from './revenue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox, Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import {
  Camera,
  ClipboardCheck,
  Download,
  DoorOpen,
  Gauge,
  KeyRound,
  LogIn,
  PencilLine,
  Plug,
  ScrollText,
} from 'lucide-react';

const SECTION_ORDER: ProtocolSection[] = ['meters', 'keys', 'condition', 'appliances', 'admin'];

const SECTION_ICON: Record<ProtocolSection, React.ComponentType<{ className?: string }>> = {
  meters: Gauge,
  keys: KeyRound,
  condition: Camera,
  appliances: Plug,
  admin: ScrollText,
};

/**
 * פרוטוקול כניסה / יציאה.
 *
 * Both parties write entries. Completing is owner-only. A completed run is
 * locked — completedAt is the lock, not a style.
 */
export function ProtocolPanel({ propertyId }: { propertyId: string }) {
  const { data: runs = [], isLoading, isError, refetch } = useProtocols();
  const { data: property } = useProperty(propertyId);
  const { data: comparison } = useProtocolComparison(propertyId);
  const start = useStartProtocol();
  const pushToast = useStore((s) => s.pushToast);

  const mine = runs
    .filter((r) => r.propertyId === propertyId)
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const active = mine.find((r) => r.id === (activeId ?? mine[0]?.id));
  const canComplete = property?.scope === 'owner';

  const begin = (kind: ProtocolKind) => {
    start.mutate(
      { propertyId, kind },
      {
        onSuccess: (run) => {
          setActiveId(run.id);
          pushToast(kind === 'move_in' ? t.protocol.moveIn : t.protocol.moveOut, 'success');
        },
      },
    );
  };

  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading) return <ListSkeleton rows={4} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">{t.protocol.title}</h2>
          <p className="mt-0.5 text-xs text-muted">{t.protocol.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={start.isPending} onClick={() => begin('move_in')}>
            <LogIn className="h-3.5 w-3.5" />
            {t.protocol.startMoveIn}
          </Button>
          <Button size="sm" loading={start.isPending} onClick={() => begin('move_out')}>
            <DoorOpen className="h-3.5 w-3.5" />
            {t.protocol.startMoveOut}
          </Button>
        </div>
      </div>

      {mine.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t.protocol.empty}
          hint={t.protocol.emptyHint}
          action={t.protocol.startMoveIn}
          onAction={() => begin('move_in')}
        />
      ) : (
        <>
          {mine.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {mine.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setActiveId(run.id)}
                  aria-pressed={run.id === active?.id}
                  className={cn(
                    'press-sm rounded-full border px-3 py-1.5 text-2xs font-bold',
                    'transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)]',
                    run.id === active?.id
                      ? 'border-ink bg-ink text-on-ink'
                      : 'border-line text-ink-soft hover:border-line-strong',
                  )}
                >
                  {run.kind === 'move_in' ? t.protocol.moveIn : t.protocol.moveOut}
                  <Num board className="ms-1.5 font-medium opacity-70">
                    {formatDate(run.startedAt)}
                  </Num>
                </button>
              ))}
            </div>
          ) : null}

          {active ? <ProtocolEditor run={active} canComplete={canComplete} /> : null}

          {comparison && comparison.rows.some((row) => row.changed) ? (
            <section className="rounded-[var(--radius-card)] border border-line p-4">
              <h3 className="mb-2 text-sm font-bold text-ink">{t.protocol.compare}</h3>
              <ul className="space-y-1.5">
                {comparison.rows
                  .filter((row) => row.changed)
                  .map((row) => (
                    <li key={row.itemId} className="flex items-baseline justify-between gap-3 text-2xs">
                      <span className="text-ink-soft">{row.label}</span>
                      <span className="text-muted">
                        {row.moveIn ?? '—'} → {row.moveOut ?? '—'}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function ProtocolEditor({ run, canComplete }: { run: ProtocolRun; canComplete: boolean }) {
  const update = useUpdateProtocolEntry();
  const complete = useCompleteProtocol();
  const pushToast = useStore((s) => s.pushToast);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [photoItem, setPhotoItem] = React.useState<string | null>(null);

  const byItem = new Map(run.entries.map((e) => [e.itemId, e]));
  const done = run.entries.filter((e) => e.done).length;
  const requiredLeft = run.missingRequired.length;
  const locked = Boolean(run.completedAt);

  const patch = (itemId: string, body: { done?: boolean; value?: string | null; photos?: string[]; note?: string | null }) => {
    if (locked) return;
    update.mutate({ runId: run.id, itemId, ...body });
  };

  const addPhoto = async (itemId: string, file: File) => {
    const url = await uploadFile(file, 'protocol');
    const existing = byItem.get(itemId)?.photos ?? [];
    patch(itemId, { photos: [...existing, url], done: true });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">
            {run.kind === 'move_in' ? t.protocol.moveIn : t.protocol.moveOut}
            {run.tenantName ? <span className="ms-2 text-xs font-normal text-muted">{run.tenantName}</span> : null}
          </h3>
          <span className="text-2xs text-muted">
            {locked ? (
              <>
                {t.protocol.completedAt} <Num board>{formatDateTime(run.completedAt!)}</Num>
              </>
            ) : (
              <>
                {t.protocol.startedAt} <Num board>{formatDateTime(run.startedAt)}</Num>
              </>
            )}
          </span>
        </div>

        <p className="mb-2 flex items-baseline gap-2 text-sm">
          <Num board className="text-xl font-semibold text-ink">
            {done}
          </Num>
          <span className="text-xs text-muted">
            {t.ui.of} <Num board>{protocolItems.length}</Num> {t.protocol.itemsDone}
          </span>
          {requiredLeft > 0 ? (
            <Badge tone="signalSoft" size="sm" className="ms-auto">
              <Num board>{requiredLeft}</Num> {t.protocol.requiredLeft}
            </Badge>
          ) : (
            <Badge tone="openSoft" size="sm" className="ms-auto">
              {t.crm.flagsPassed}
            </Badge>
          )}
        </p>

        <Meter
          value={done}
          max={protocolItems.length}
          tone={requiredLeft === 0 ? 'open' : 'ink'}
          label={t.protocol.progress}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {locked ? (
            <>
              <Badge tone="openSoft" size="md">
                <ClipboardCheck className="h-3 w-3" />
                {t.protocol.completed}
              </Badge>
              <Button size="sm" variant="secondary" onClick={() => pushToast(t.protocol.exported, 'success')}>
                <Download className="h-3.5 w-3.5" />
                {t.protocol.exportPdf}
              </Button>
            </>
          ) : canComplete ? (
            <>
              <Button
                size="sm"
                loading={complete.isPending}
                disabled={requiredLeft > 0}
                onClick={() =>
                  complete.mutate(run.id, { onSuccess: () => pushToast(t.protocol.completed, 'success') })
                }
              >
                <PencilLine className="h-3.5 w-3.5" />
                {t.protocol.complete}
              </Button>
              <span className="self-center text-2xs text-muted">{t.protocol.signHint}</span>
            </>
          ) : null}
        </div>
      </section>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && photoItem) void addPhoto(photoItem, file);
          e.target.value = '';
          setPhotoItem(null);
        }}
      />

      {SECTION_ORDER.map((section) => {
        const sectionItems = protocolItems.filter((i) => i.section === section);
        if (sectionItems.length === 0) return null;
        const Icon = SECTION_ICON[section];

        return (
          <section key={section}>
            <SectionTitle
              aside={
                <span className="text-2xs text-muted">
                  <Num board>{sectionItems.filter((i) => byItem.get(i.id)?.done).length}</Num>/
                  <Num board>{sectionItems.length}</Num>
                </span>
              }
            >
              <span className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-muted" />
                {t.protocol.sections[section]}
              </span>
            </SectionTitle>
            <p className="-mt-2 mb-2.5 text-2xs text-muted">{t.protocol.sectionHint[section]}</p>

            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line">
              {sectionItems.map((item) => {
                const entry = byItem.get(item.id);
                const checked = Boolean(entry?.done);

                return (
                  <li
                    key={item.id}
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-2 p-3 transition-colors duration-150',
                      checked && 'bg-surface/60',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={locked}
                      onCheckedChange={(v) => patch(item.id, { done: Boolean(v) })}
                      aria-label={item.label}
                    />

                    <span className="min-w-40 flex-1">
                      <span
                        className={cn(
                          'block text-sm font-semibold transition-colors duration-150',
                          checked ? 'text-muted' : 'text-ink',
                        )}
                      >
                        {item.label}
                      </span>
                      {entry?.note ? <span className="block text-2xs text-muted">{entry.note}</span> : null}
                    </span>

                    {item.required ? (
                      <Badge tone="outline" size="sm">
                        {t.protocol.requiredBadge}
                      </Badge>
                    ) : null}

                    {item.input === 'number' ? (
                      <label className="flex items-center gap-1.5 text-2xs text-muted">
                        <Input
                          type="number"
                          dir="ltr"
                          disabled={locked}
                          className="num h-8 w-24"
                          defaultValue={entry?.value ?? ''}
                          placeholder={item.unit}
                          onBlur={(e) => patch(item.id, { value: e.target.value, done: true })}
                          aria-label={`${item.label} — ${t.protocol.reading}`}
                        />
                        {item.unit}
                      </label>
                    ) : null}

                    {item.wants_photo ? (
                      <span className="flex items-center gap-1.5">
                        {(entry?.photos ?? []).map((src) => (
                          <img
                            key={src}
                            src={src}
                            alt=""
                            loading="lazy"
                            className="h-9 w-9 rounded-[6px] border border-line object-cover"
                          />
                        ))}
                        {!locked ? (
                          <Button
                            size="iconSm"
                            variant="secondary"
                            aria-label={`${t.protocol.addPhoto} — ${item.label}`}
                            onClick={() => {
                              setPhotoItem(item.id);
                              fileInput.current?.click();
                            }}
                          >
                            <Camera className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <OfferRail
        placement={run.kind === 'move_in' ? 'protocol_move_in' : 'protocol_move_out'}
        title={t.offers.sectionOwner}
      />
    </div>
  );
}
