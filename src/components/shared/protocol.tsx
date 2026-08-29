import * as React from 'react';
import { useStore, useStoreShallow } from '@/data/store';
import { t } from '@/i18n/he';
import { Num, SectionTitle } from './typography';
import { EmptyState } from './empty-state';
import { Meter } from './meter';
import { OfferRail } from './revenue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox, Input } from '@/components/ui/field';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProtocolKind, ProtocolRun, ProtocolSection } from '@/types';
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
 * Deposit disputes are won on paper. The design bets on two things: the same
 * item list for both directions so the runs can be compared line by line, and
 * making the photo the fastest action on every condition row — because the
 * photo is the part that actually settles the argument.
 */
export function ProtocolPanel({ propertyId }: { propertyId: string }) {
  const { protocolRuns, protocolItems, tenants } = useStoreShallow((s) => ({
    protocolRuns: s.protocolRuns,
    protocolItems: s.protocolItems,
    tenants: s.tenants,
  }));
  const startProtocol = useStore((s) => s.startProtocol);
  const pushToast = useStore((s) => s.pushToast);

  const runs = protocolRuns
    .filter((r) => r.property_id === propertyId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  const [activeId, setActiveId] = React.useState<string | null>(runs[0]?.id ?? null);
  const active = runs.find((r) => r.id === activeId) ?? runs[0];

  const begin = (kind: ProtocolKind) => {
    const id = startProtocol(propertyId, kind);
    setActiveId(id);
    pushToast(kind === 'move_in' ? t.protocol.moveIn : t.protocol.moveOut, 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">{t.protocol.title}</h2>
          <p className="mt-0.5 text-xs text-muted">{t.protocol.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => begin('move_in')}>
            <LogIn className="h-3.5 w-3.5" />
            {t.protocol.startMoveIn}
          </Button>
          <Button size="sm" onClick={() => begin('move_out')}>
            <DoorOpen className="h-3.5 w-3.5" />
            {t.protocol.startMoveOut}
          </Button>
        </div>
      </div>

      {runs.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t.protocol.empty}
          hint={t.protocol.emptyHint}
          action={t.protocol.startMoveIn}
          onAction={() => begin('move_in')}
        />
      ) : (
        <>
          {runs.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {runs.map((run) => (
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
                    {formatDate(run.started_at)}
                  </Num>
                </button>
              ))}
            </div>
          ) : null}

          {active ? (
            <ProtocolRunView
              run={active}
              items={protocolItems}
              tenantName={tenants.find((x) => x.id === active.tenant_id)?.name}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function ProtocolRunView({
  run,
  items,
  tenantName,
}: {
  run: ProtocolRun;
  items: ReturnType<typeof useStore.getState>['protocolItems'];
  tenantName?: string;
}) {
  const setEntry = useStore((s) => s.setProtocolEntry);
  const addPhoto = useStore((s) => s.addProtocolPhoto);
  const complete = useStore((s) => s.completeProtocol);
  const pushToast = useStore((s) => s.pushToast);

  const byItem = new Map(run.entries.map((e) => [e.item_id, e]));
  const done = run.entries.filter((e) => e.done).length;
  const requiredLeft = items.filter((i) => i.required && !byItem.get(i.id)?.done).length;
  const locked = Boolean(run.completed_at);

  return (
    <div className="space-y-5">
      {/* Progress */}
      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">
            {run.kind === 'move_in' ? t.protocol.moveIn : t.protocol.moveOut}
            {tenantName ? <span className="ms-2 text-xs font-normal text-muted">{tenantName}</span> : null}
          </h3>
          <span className="text-2xs text-muted">
            {locked ? (
              <>
                {t.protocol.completedAt} <Num board>{formatDateTime(run.completed_at!)}</Num>
              </>
            ) : (
              <>
                {t.protocol.startedAt} <Num board>{formatDateTime(run.started_at)}</Num>
              </>
            )}
          </span>
        </div>

        <p className="mb-2 flex items-baseline gap-2 text-sm">
          <Num board className="text-xl font-semibold text-ink">
            {done}
          </Num>
          <span className="text-xs text-muted">
            {t.ui.of} <Num board>{items.length}</Num> {t.protocol.itemsDone}
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
          max={items.length}
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
          ) : (
            <>
              <Button
                size="sm"
                disabled={requiredLeft > 0}
                onClick={() => {
                  complete(run.id);
                  pushToast(t.protocol.completed, 'success');
                }}
              >
                <PencilLine className="h-3.5 w-3.5" />
                {t.protocol.complete}
              </Button>
              <span className="self-center text-2xs text-muted">{t.protocol.signHint}</span>
            </>
          )}
        </div>
      </section>

      {/* Sections */}
      {SECTION_ORDER.map((section) => {
        const sectionItems = items.filter((i) => i.section === section);
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
                      onCheckedChange={(v) => setEntry(run.id, item.id, { done: Boolean(v) })}
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
                      {entry?.note ? (
                        <span className="block text-2xs text-muted">{entry.note}</span>
                      ) : null}
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
                          value={entry?.value ?? ''}
                          placeholder={item.unit}
                          onChange={(e) =>
                            setEntry(run.id, item.id, { value: e.target.value, done: true })
                          }
                          aria-label={`${item.label} — ${t.protocol.reading}`}
                        />
                        {item.unit}
                      </label>
                    ) : null}

                    {item.wants_photo ? (
                      <span className="flex items-center gap-1.5">
                        {entry?.photos.map((src) => (
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
                            onClick={() => addPhoto(run.id, item.id)}
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

      {/* Services the moment naturally calls for */}
      <OfferRail
        placement={run.kind === 'move_in' ? 'protocol_move_in' : 'protocol_move_out'}
        title={run.kind === 'move_in' ? t.offers.sectionOwner : t.offers.sectionOwner}
      />
    </div>
  );
}
