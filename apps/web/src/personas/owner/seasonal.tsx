import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t, daysUntil, formatMonthYear, formatUntil, type Season, type SeasonalTaskTemplate } from '@miftach/shared';
import { Money, Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { Meter } from '@/components/shared/meter';
import { OfferRail, RevenueMarker } from '@/components/shared/revenue';
import { ListSkeleton } from '@/components/shared/skeleton';
import { useDelayedReady } from '@/lib/use-delayed-ready';
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
  const ready = useDelayedReady();
  const { seasonalTemplates, seasonalTasks, properties } = useStoreShallow((s) => ({
    seasonalTemplates: s.seasonalTemplates,
    seasonalTasks: s.seasonalTasks,
    properties: s.properties,
  }));
  const scheduleTemplate = useStore((s) => s.scheduleSeasonalTemplate);
  const scheduleTask = useStore((s) => s.scheduleSeasonalTask);
  const completeTask = useStore((s) => s.completeSeasonalTask);
  const skipTask = useStore((s) => s.skipSeasonalTask);
  const pushToast = useStore((s) => s.pushToast);

  const [expanded, setExpanded] = React.useState<string | null>(null);

  /** Group by template, ordered by how soon the first unit is due. */
  const groups = React.useMemo(() => {
    return seasonalTemplates
      .map((template) => {
        const tasks = seasonalTasks.filter((x) => x.template_id === template.id);
        const due = tasks.filter((x) => x.status === 'due');
        const scheduled = tasks.filter((x) => x.status === 'scheduled');
        const done = tasks.filter((x) => x.status === 'done');
        const nextDate = tasks[0]?.due_date;
        return {
          template,
          tasks,
          due,
          scheduled,
          done,
          nextDate,
          daysAway: nextDate ? daysUntil(nextDate) : 9999,
        };
      })
      .filter((g) => g.tasks.length > 0)
      .sort((a, b) => a.daysAway - b.daysAway);
  }, [seasonalTemplates, seasonalTasks]);

  const soon = groups.filter((g) => g.daysAway <= 75);
  const later = groups.filter((g) => g.daysAway > 75);

  /* Expected value, not gross: a skipped task only costs you the failure some
     of the time. Multiplying by failure_rate is the difference between a real
     number and a sales number. */
  const potentialSaving = groups.reduce(
    (sum, g) =>
      sum +
      g.due.length *
        Math.max(0, g.template.avoided_cost * g.template.failure_rate - g.template.typical_cost),
    0,
  );
  const totalTasks = seasonalTasks.length;
  const handled = seasonalTasks.filter((x) => x.status !== 'due').length;

  return (
    <div className="space-y-5">
      <PageHeader title={t.seasonal.title} subtitle={t.seasonal.subtitle} />

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

      {!ready ? (
        <ListSkeleton rows={4} />
      ) : groups.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t.seasonal.empty} hint={t.seasonal.emptyHint} />
      ) : (
        <>
          <TaskGroupList
            title={t.seasonal.thisSeason}
            groups={soon}
            properties={properties}
            expanded={expanded}
            setExpanded={setExpanded}
            onScheduleAll={(id, count) => {
              scheduleTemplate(id);
              pushToast(`${t.seasonal.allScheduled} · ${count}`, 'success');
            }}
            onScheduleOne={(id) => {
              scheduleTask(id);
              pushToast(t.seasonal.scheduled, 'success');
            }}
            onComplete={completeTask}
            onSkip={skipTask}
            onOpenTicket={() => navigate('/owner/tickets')}
          />

          {later.length ? (
            <TaskGroupList
              title={t.seasonal.upcoming}
              groups={later}
              properties={properties}
              expanded={expanded}
              setExpanded={setExpanded}
              muted
              onScheduleAll={(id, count) => {
                scheduleTemplate(id);
                pushToast(`${t.seasonal.allScheduled} · ${count}`, 'success');
              }}
              onScheduleOne={(id) => {
                scheduleTask(id);
                pushToast(t.seasonal.scheduled, 'success');
              }}
              onComplete={completeTask}
              onSkip={skipTask}
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
  template: SeasonalTaskTemplate;
  tasks: ReturnType<typeof useStore.getState>['seasonalTasks'];
  due: ReturnType<typeof useStore.getState>['seasonalTasks'];
  scheduled: ReturnType<typeof useStore.getState>['seasonalTasks'];
  done: ReturnType<typeof useStore.getState>['seasonalTasks'];
  nextDate?: string;
  daysAway: number;
}

function TaskGroupList({
  title,
  groups,
  properties,
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
  properties: ReturnType<typeof useStore.getState>['properties'];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  muted?: boolean;
  onScheduleAll: (templateId: string, count: number) => void;
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
          const open = expanded === template.id;
          /* Ratio is expected cost avoided per shekel spent, not gross. */
          const ratio = template.typical_cost
            ? Math.round((template.avoided_cost * template.failure_rate) / template.typical_cost)
            : null;

          return (
            <li
              key={template.id}
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
                    <Money value={template.typical_cost} board className="font-bold text-ink" />
                  </span>
                  <span className="text-muted">
                    {t.seasonal.avoidedCost}:{' '}
                    <Money value={template.avoided_cost} board className="font-bold text-alert" />
                  </span>
                  <span className="text-muted">
                    {t.seasonal.failureRate}:{' '}
                    <Num board className="font-bold text-ink">
                      {Math.round(template.failure_rate * 100)}%
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
                    <Button size="sm" onClick={() => onScheduleAll(template.id, group.due.length)}>
                      <Flame className="h-3.5 w-3.5" />
                      {t.seasonal.scheduleAll} · <Num board>{group.due.length}</Num>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : template.id)}>
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
                    const property = properties.find((p) => p.id === task.property_id);
                    return (
                      <li key={task.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                        <span className="min-w-40 flex-1 text-xs font-semibold text-ink">
                          {property ? `${property.address.street} ${property.address.number}` : ''}
                          <span className="ms-2 font-normal text-muted">
                            {property?.address.neighborhood}
                          </span>
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
