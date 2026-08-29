import * as React from 'react';
import { useStore, useStoreShallow } from '@/data/store';
import { t, formatAge, type Role } from '@miftach/shared';
import { Num, PageHeader } from '@/components/shared/typography';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/field';
import { ListSkeleton } from '@/components/shared/skeleton';
import { useDelayedReady } from '@/lib/use-delayed-ready';
import { cn } from '@/lib/utils';
import { Inbox, MessageSquare, Send } from 'lucide-react';

type Filter = 'all' | 'tenant' | 'lead' | 'vendor';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: t.messages.all },
  { id: 'tenant', label: t.messages.tenants },
  { id: 'lead', label: t.messages.leads },
  { id: 'vendor', label: t.messages.vendorsTab },
];

const ROLE_TONE: Record<Role, 'liveSoft' | 'signalSoft' | 'neutral' | 'openSoft'> = {
  tenant: 'liveSoft',
  lead: 'signalSoft',
  vendor: 'neutral',
  owner: 'openSoft',
};

export function OwnerMessages() {
  const ready = useDelayedReady();
  const { threads, properties } = useStoreShallow((s) => ({
    threads: s.threads,
    properties: s.properties,
  }));
  const markThreadRead = useStore((s) => s.markThreadRead);
  const sendThreadMessage = useStore((s) => s.sendThreadMessage);

  const [filter, setFilter] = React.useState<Filter>('all');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');

  const propertyById = React.useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const rows = React.useMemo(
    () =>
      threads
        .filter((th) => filter === 'all' || th.counterparty_role === filter)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [threads, filter],
  );

  const selected = threads.find((th) => th.id === selectedId) ?? null;
  const unreadCount = threads.filter((th) => th.messages.some((m) => !m.read)).length;

  const open = (id: string) => {
    setSelectedId(id);
    markThreadRead(id);
    setDraft('');
  };

  const send = () => {
    if (!selected || !draft.trim()) return;
    sendThreadMessage(selected.id, draft.trim(), 'owner');
    setDraft('');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.messages.title}
        subtitle={t.messages.subtitle}
        actions={
          unreadCount ? (
            <Badge tone="alertSoft">
              <Num board>{unreadCount}</Num> {t.messages.unread}
            </Badge>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors duration-150',
              filter === f.id
                ? 'border-ink bg-ink text-on-ink'
                : 'border-line text-ink-soft hover:border-line-strong',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!ready ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Inbox} title={t.messages.empty} hint={t.messages.emptyHint} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          {/* Thread list */}
          <ul
            className={cn(
              'divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line',
              selected && 'max-lg:hidden',
            )}
          >
            {rows.map((thread) => {
              const unread = thread.messages.filter((m) => !m.read).length;
              const property = thread.property_id ? propertyById.get(thread.property_id) : undefined;
              const last = thread.messages[thread.messages.length - 1];
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => open(thread.id)}
                    className={cn(
                      'w-full px-3.5 py-3 text-start transition-colors duration-150 hover:bg-surface',
                      selectedId === thread.id && 'bg-surface',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                        {thread.counterparty_name}
                      </span>
                      <Badge tone={ROLE_TONE[thread.counterparty_role]} size="sm">
                        {thread.counterparty_role === 'tenant'
                          ? t.persona.tenant
                          : thread.counterparty_role === 'lead'
                            ? t.crm.title
                            : t.vendors.title}
                      </Badge>
                      {unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-alert" /> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-soft">{thread.subject}</span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-2xs text-muted">
                      {property ? (
                        <span className="truncate">
                          {t.messages.aboutUnit} {property.address.street} {property.address.number}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="shrink-0">{formatAge(last.at)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Thread view */}
          {!selected ? (
            <div className="hidden lg:block">
              <EmptyState
                icon={MessageSquare}
                title={t.messages.selectThread}
                hint={t.messages.selectThreadHint}
                className="h-full"
              />
            </div>
          ) : (
            <section className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line">
              <header className="flex items-center gap-2 border-b border-line bg-surface px-3.5 py-3">
                <Button
                  variant="quiet"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSelectedId(null)}
                >
                  {t.shell.back}
                </Button>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-ink">{selected.counterparty_name}</h2>
                  <p className="truncate text-2xs text-muted">{selected.subject}</p>
                </div>
              </header>

              <ul className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
                {selected.messages.map((message) => {
                  const mine = message.author_role === 'owner';
                  return (
                    <li
                      key={message.id}
                      className={cn(
                        'max-w-[85%] rounded-[var(--radius-card)] px-3 py-2',
                        mine ? 'ms-auto bg-ink text-on-ink' : 'bg-surface text-ink-soft',
                      )}
                    >
                      <p
                        className={cn(
                          'mb-0.5 flex items-baseline justify-between gap-3 text-2xs',
                          mine ? 'text-on-ink-muted' : 'text-muted',
                        )}
                      >
                        <span className="font-bold">{message.author_name}</span>
                        <span>{formatAge(message.at)}</span>
                      </p>
                      <p className="text-sm leading-6">{message.body}</p>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-end gap-2 border-t border-line p-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t.messages.write}
                  className="min-h-14"
                  aria-label={t.messages.write}
                />
                <Button size="icon" onClick={send} disabled={!draft.trim()} aria-label={t.messages.send}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
