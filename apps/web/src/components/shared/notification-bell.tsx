import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useNavigate } from 'react-router-dom';
import { t, formatAge, formatDateTime, type NotificationView } from '@miftan/shared';
import { useMarkNotificationsSeen, useNotifications } from '@/api/hooks';
import { cn } from '@/lib/utils';
import { Num } from './typography';
import { Bell, Building2, KeyRound, Search } from 'lucide-react';

const ROLE_ICON = { owner: Building2, tenant: KeyRound, seeker: Search } as const;

/**
 * The bell. One feed for every role the account holds, each item marked with
 * the role it concerns, because an account that owns, rents and searches
 * should not have to switch views to learn that something happened.
 *
 * Opening it marks everything seen — a count that only goes down when each
 * item is tapped trains people to ignore the count.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markSeen = useMarkNotificationsSeen();
  const [open, setOpen] = React.useState(false);

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && unread > 0) markSeen.mutate();
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        aria-label={t.notifications.open}
        className="press relative flex items-center rounded-[var(--radius-control)] px-2.5 py-1.5 text-on-ink-muted hover:bg-white/10 hover:text-on-ink"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 end-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-alert px-1 text-[10px] font-bold leading-none text-white">
            <Num>{unread > 9 ? '9+' : unread}</Num>
          </span>
        ) : null}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          style={{ zIndex: 'var(--z-dropdown)' }}
          className="pop-anim w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--radius-panel)] border border-line bg-bg shadow-xl"
        >
          <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-sm font-bold text-ink">{t.notifications.title}</h2>
            {unread > 0 ? (
              <span className="text-2xs text-muted">{t.notifications.unread.replace('{n}', String(unread))}</span>
            ) : null}
          </header>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-bold text-ink">{t.notifications.empty}</p>
              <p className="mt-1 text-2xs leading-5 text-muted">{t.notifications.emptyHint}</p>
            </div>
          ) : (
            <ul className="max-h-[min(28rem,70dvh)] divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate(item.href);
                    }}
                    className={cn(
                      'press-sm flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-surface',
                      item.unread && 'bg-surface/60',
                    )}
                  >
                    <RoleMark role={item.role} unread={item.unread} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm leading-5', item.unread ? 'font-bold text-ink' : 'text-ink-soft')}>
                        {textFor(item)}
                      </span>
                      <span className="mt-0.5 block text-2xs text-muted">{formatAge(item.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RoleMark({ role, unread }: { role: NotificationView['role']; unread: boolean }) {
  const Icon = ROLE_ICON[role];
  return (
    <span className="relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-ink-soft">
      <Icon className="h-4 w-4" />
      {unread ? <span aria-hidden className="absolute -top-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-alert" /> : null}
    </span>
  );
}

/** The server sends a kind and its facts; the words live in he.ts. */
function textFor(item: NotificationView): string {
  let detail = item.detail ?? '';
  if (item.kind === 'application_stage' && item.detail) {
    detail = t.leadStage[item.detail as keyof typeof t.leadStage] ?? item.detail;
  }
  if (item.kind === 'visit_scheduled' && item.date) {
    /* First-strong isolate: an LTR date inside a Hebrew sentence must not
       be reordered by the bidi algorithm. */
    detail = `${detail} · \u2068${formatDateTime(item.date)}\u2069`;
  }
  return t.notifications.kinds[item.kind]
    .replace('{label}', item.propertyLabel)
    .replace('{detail}', detail);
}
