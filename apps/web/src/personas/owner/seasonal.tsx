import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/data/store';
import { useScheduleSeasonal, useSeasonal, useSeasonalStatus } from '@/api/hooks';
import { ErrorState } from '@/components/shared/error-state';
import { t, daysUntil, formatMonthYear, formatUntil, type Season, type SeasonalTaskView } from '@miftan/shared';
import { Money, Num } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { Meter } from '@/components/shared/meter';
import { OfferRail, RevenueMarker } from '@/components/shared/revenue';
import { ListSkeleton } from '@/components/shared/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CalendarClock,
  Check,
  Droplets,
  Flame,
  Leaf,
  ShieldCheck,
  Snowflake,
  Sun,
  X,
} from 'lucide-react';

const SEASON_ICON: Record<Season, React.ComponentType<{ className?: string }>> = {
  spring: Leaf,
  summer: Sun,
  autumn: Droplets,
  winter: Snowflake,
};

export function OwnerSeasonal() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useSeasonal();
  const setStatus = useSeasonalStatus();
  const schedule = useScheduleSeasonal();
  const pushToast = useStore((s) => s.pushToast);

  const [expanded, setExpanded] = React.useState<string | null>(null);

  const tasks = data?.tasks ?? [];

  /**
   * Grouped by template, ordered by how soon the first unit is due.
   *
   * The server returns flat tasks with the template denormalised onto each —
   * so a retired template does not blank out history — and the grouping is a
   * presentation choice, made here.
   */
  const groups = React.useMemo(() => {
    const byTemplate = new Map<string, SeasonalTaskView[]>();
    for (const task of tasks) {
      const list = byTemplate.get(task.templateId) ?? [];
      list.push(task);
      byTemplate.set(task.templateId, list);
    }

    return [...byTemplate.values()]
      .map((group) => {
        const sorted = group.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const nextDate = sorted[0]?.dueDate;
        return {
          template: sorted[0],
          tasks: sorted,
          due: sorted.filter((x) => x.status === 'due'),
          scheduled: sorted.filter((x) => x.status === 'scheduled'),
          done: sorted.filter((x) => x.status === 'done'),
          nextDate,
          daysAway: nextDate ? daysUntil(nextDate) : 9999,
        };
      })
      .sort((a, b) => a.daysAway - b.daysAway);
  }, [tasks]);

  const soon = groups.filter((g) => g.daysAway <= 75);
  const later = groups.filter((g) => g.daysAway > 75);

  /* Computed on the server, from the same expected-value arithmetic the
     dashboard uses. Recomputing it here is how the two start disagreeing. */
  const potentialSaving = data?.outstandingExpectedSaving ?? 0;
  const totalTasks = tasks.length;
  const handled = tasks.filter((x) => x.status !== 'due').length;

  const scheduleAll = (group: { due: SeasonalTaskView[] }) => {
    /* No bulk endpoint: a handful of sequential writes is honest, and each one
       creates a real ticket that the board has to see. */
    void Promise.all(group.due.map((task) => schedule.mutateAsync({ id: task.id }))).then(() =>
      pushToast(`${t.seasonal.allScheduled} · ${group.due.length}`, 'success'),
    );
  };

  return (
    <div className="space-y-5">
      
      {/* The argument, up front: what preventing costs vs what failing costs */}
      <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr]">
        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <h2 className="mb-1 text-sm font-bold text-ink">{t.seasonal.potentialSaving}</h2>
          <Money value={potentialSaving} board className="text-2xl font-semibold text-ink" />
          <p className="mt-1.5 text-2xs leading-4 text-muted">{t.seasonal.potentialSavingHint}</p>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">{t.seasonal.coverage}</h2>
            <span className="text-xs font-bold text-ink-soft">
              <Num board>{handled}</Num>/<Num board>{totalTasks}</Num>
            </span>
          </div>
          <Meter value={handled} max={totalTasks} tone="open" label={t.seasonal.coverage} />
          <p className="mt-1.5 text-2xs text-muted">{t.seasonal.coverageHint}</p>
        </section>
      </div>

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : groups.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t.seasonal.empty} hint={t.seasonal.emptyHint} />
      ) : (
        <>
          <TaskGroupList
            title={t.seasonal.thisSeason}
            groups={soon}
            expanded={expanded}
            setExpanded={setExpanded}
            onScheduleAll={scheduleAll}
            onScheduleOne={(id) =>
              schedule.mutate({ id }, { onSuccess: () => pushToast(t.seasonal.scheduled, 'success') })
            }
            onComplete={(id) => setStatus.mutate({ id, status: 'done' })}
            onSkip={(id) => setStatus.mutate({ id, status: 'skipped' })}
            onOpenTicket={() => navigate('/owner/tickets')}
          />

          {later.length ? (
            <TaskGroupList
              title={t.seasonal.upcoming}
              groups={later}
                expanded={expanded}
              setExpanded={setExpanded}
              muted
              onScheduleAll={scheduleAll}
              onScheduleOne={(id) =>
                schedule.mutate({ id }, { onSuccess: () => pushToast(t.seasonal.scheduled, 'success') })
              }
              onComplete={(id) => setStatus.mutate({ id, status: 'done' })}
              onSkip={(id) => setStatus.mutate({ id, status: 'skipped' })}
              onOpenTicket={() => navigate('/owner/tickets')}
            />
          ) : null}
        </>
      )}

      <OfferRail placement="seasonal" audience="owner" />
    </div>
  );
}

interface Group {
  /** The first task in the group — every one carries the same template fields */
  template: SeasonalTaskView;
  tasks: SeasonalTaskView[];
  due: SeasonalTaskView[];
  scheduled: SeasonalTaskView[];
  done: SeasonalTaskView[];
  nextDate?: string;
  daysAway: number;
}

function TaskGroupList({
  title,
  groups,
  expanded,
  setExpanded,
  muted,
  onScheduleAll,
  onScheduleOne,
  onComplete,
  onSkip,
  onOpenTicket,
}: {
  title: string;
  groups: Group[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  muted?: boolean;
  onScheduleAll: (group: Group) => void;
  onScheduleOne: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onSkip: (taskId: string) => void;
  onOpenTicket: () => void;
}) {
  if (groups.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold text-ink">{title}</h2>
      <ul className={cn('stagger space-y-2.5', muted && 'opacity-85')}>
        {groups.map((group) => {
          const { template } = group;
          const Icon = SEASON_ICON[template.season];
          const open = expanded === template.templateId;
          /* Ratio is expected cost avoided per shekel spent, not gross. */
          const ratio = template.typicalCost
            ? Math.round((template.avoidedCost * template.failureRate) / template.typicalCost)
            : null;

          return (
            <li
              key={template.templateId}
              className={cn(
                'overflow-hidden rounded-[var(--radius-card)] border transition-colors duration-200',
                group.due.length && group.daysAway <= 45 ? 'border-signal/50' : 'border-line',
              )}
            >
              <div className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface">
                    <Icon className="h-4 w-4 text-ink-soft" />
                  </span>

                  <div className="min-w-48 flex-1">
                    <h3 className="text-sm font-bold text-ink">{template.title}</h3>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted">
                      <Badge tone="outline" size="sm">
                        {t.seasonal.season[template.season]}
                      </Badge>
                      <span>
                        {group.nextDate ? formatMonthYear(group.nextDate) : ''} ·{' '}
                        {group.daysAway <= 0 ? t.seasonal.dueNow : formatUntil(group.nextDate!)}
                      </span>
                      <span>
                        <Num board className="font-bold text-ink">
                          {group.tasks.length}
                        </Num>{' '}
                        {t.seasonal.units}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {group.done.length ? (
                      <Badge tone="openSoft" size="sm">
                        <Num board>{group.done.length}</Num> {t.seasonal.done}
                      </Badge>
                    ) : null}
                    {group.scheduled.length ? (
                      <Badge tone="liveSoft" size="sm">
                        <Num board>{group.scheduled.length}</Num> {t.seasonal.scheduled}
                      </Badge>
                    ) : null}
                    {group.due.length ? (
                      <Badge tone="signalSoft" size="sm">
                        <Num board>{group.due.length}</Num> {t.seasonal.dueNow}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <p className="mt-2.5 text-xs leading-5 text-ink-soft">{template.why}</p>

                {/* The economics, stated plainly */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-control)] bg-surface px-3 py-2 text-2xs">
                  <span className="text-muted">
                    {t.seasonal.typicalCost}:{' '}
                    <Money value={template.typicalCost} board className="font-bold text-ink" />
                  </span>
                  <span className="text-muted">
                    {t.seasonal.avoidedCost}:{' '}
                    <Money value={template.avoidedCost} board className="font-bold text-alert" />
                  </span>
                  <span className="text-muted">
                    {t.seasonal.failureRate}:{' '}
                    <Num board className="font-bold text-ink">
                      {Math.round(template.failureRate * 100)}%
                    </Num>
                  </span>
                  {ratio && ratio > 1 ? (
                    <span className="flex items-center gap-1 font-bold text-open">
                      <ShieldCheck className="h-3 w-3" />
                      <Num board>×{ratio}</Num> {t.seasonal.savingRatio}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {group.due.length ? (
                    <Button size="sm" onClick={() => onScheduleAll(group)}>
                      <Flame className="h-3.5 w-3.5" />
                      {t.seasonal.scheduleAll} · <Num board>{group.due.length}</Num>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : template.templateId)}>
                    {open ? t.ui.showLess : `${t.seasonal.units} · ${group.tasks.length}`}
                  </Button>
                  {group.scheduled.length ? (
                    <Button size="sm" variant="ghost" onClick={onOpenTicket}>
                      {t.ownerNav.tickets}
                    </Button>
                  ) : null}
                  <RevenueMarker streamId="rs-seasonal" className="ms-auto" />
                </div>
              </div>

              {open ? (
                <ul className="divide-y divide-line border-t border-line bg-surface/50">
                  {group.tasks.map((task) => {
                    return (
                      <li key={task.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                        <span className="min-w-40 flex-1 text-xs font-semibold text-ink">
                          {task.propertyLabel}
                        </span>

                        {task.status === 'due' ? (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => onScheduleOne(task.id)}>
                              {t.seasonal.scheduleOne}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onSkip(task.id)}>
                              {t.seasonal.skip}
                            </Button>
                          </>
                        ) : task.status === 'scheduled' ? (
                          <>
                            <Badge tone="liveSoft" size="sm">
                              {t.seasonal.scheduled}
                            </Badge>
                            <Button size="sm" variant="ghost" onClick={() => onComplete(task.id)}>
                              <Check className="h-3.5 w-3.5" />
                              {t.seasonal.markDone}
                            </Button>
                          </>
                        ) : task.status === 'done' ? (
                          <Badge tone="openSoft" size="sm">
                            <Check className="h-3 w-3" strokeWidth={3} />
                            {t.seasonal.done}
                          </Badge>
                        ) : (
                          <Badge tone="outline" size="sm">
                            <X className="h-3 w-3" />
                            {t.seasonal.skipped}
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
