import * as React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '@/data/store';
import { APP_NAME, t } from '@/i18n/he';
import { cn } from '@/lib/utils';
import { PersonaSwitcher } from './persona-switcher';
import { Toaster } from '@/components/shared/toaster';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Num } from '@/components/shared/typography';
import { RevenueLensToggle } from '@/components/shared/revenue';
import { OPEN_TICKET_STATUSES } from '@/data/selectors';
import {
  Banknote,
  CalendarClock,
  FileSignature,
  MessageCircleQuestion,
  CalendarCheck2,
  FileText,
  Gauge,
  Home,
  Inbox,
  KeyRound,
  ListChecks,
  MapPin,
  RotateCcw,
  Search,
  Users,
  Wrench,
  Coins,
} from 'lucide-react';
import { daysUntil } from '@/lib/format';

interface NavItem {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  count?: number;
}

/* ── Top bar — the one dark band, present in every persona ─── */

function TopBar() {
  const [resetOpen, setResetOpen] = React.useState(false);
  const resetDemo = useStore((s) => s.resetDemo);
  const pushToast = useStore((s) => s.pushToast);

  return (
    <header
      style={{ zIndex: 'var(--z-sticky)' }}
      className="sticky top-0 flex h-14 shrink-0 items-center gap-3 bg-ink px-3 sm:px-4"
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-signal text-ink">
          <KeyRound className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <span className="hidden text-base font-extrabold tracking-[-0.01em] text-on-ink sm:inline">
          {APP_NAME}
        </span>
        <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-on-ink-muted lg:inline">
          {t.shell.demoBadge}
        </span>
      </div>

      <div className="flex flex-1 justify-center">
        <PersonaSwitcher />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <RevenueLensToggle />
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="press flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs font-semibold text-on-ink-muted transition-[color,background-color,transform] duration-[var(--dur-press)] ease-[var(--ease-out)] hover:bg-white/10 hover:text-on-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{t.shell.resetDemo}</span>
        </button>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.shell.resetDemoConfirm}</DialogTitle>
            <DialogDescription>{t.shell.resetDemoBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="danger"
              onClick={() => {
                resetDemo();
                setResetOpen(false);
                pushToast(t.shell.resetDemo, 'success');
              }}
            >
              {t.shell.resetDemoAction}
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">{t.shell.cancel}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

/* ── Nav pieces ────────────────────────────────────────── */

function RailLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'press-sm flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold',
          'transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)]',
          isActive ? 'bg-ink text-on-ink' : 'text-ink-soft hover:bg-surface-sunk hover:text-ink',
        )
      }
    >
      <item.Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count ? (
        <Num className="rounded-full bg-current/10 px-1.5 text-2xs font-bold tabular-nums">
          {item.count}
        </Num>
      ) : null}
    </NavLink>
  );
}

function BottomTabs({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label={t.shell.mainNav}
      style={{ zIndex: 'var(--z-sticky)' }}
      className="sticky bottom-0 flex shrink-0 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition-colors duration-150',
              isActive ? 'text-ink' : 'text-muted',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span className="relative">
                <item.Icon className="h-5 w-5" />
                {item.count ? (
                  <span className="absolute -top-1 -end-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-alert px-1 text-[9px] font-bold text-white">
                    <Num>{item.count}</Num>
                  </span>
                ) : null}
              </span>
              <span className="truncate">{item.label}</span>
              {isActive ? (
                <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-ink" />
              ) : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function TopNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label={t.shell.mainNav}
      className="hide-scrollbar hidden gap-1 overflow-x-auto border-b border-line px-4 md:flex"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors duration-150',
              'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors',
              isActive ? 'text-ink after:bg-ink' : 'text-muted after:bg-transparent hover:text-ink',
            )
          }
        >
          <item.Icon className="h-4 w-4" />
          {item.label}
          {item.count ? (
            <Num className="rounded-full bg-surface-sunk px-1.5 text-2xs font-bold">{item.count}</Num>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}

/** Scroll to top on route change — otherwise deep pages open mid-scroll. */
function useScrollReset(ref: React.RefObject<HTMLElement>) {
  const { pathname } = useLocation();
  React.useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [pathname, ref]);
}

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:rounded-[var(--radius-control)] focus:bg-bg focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-ink"
      style={{ zIndex: 'var(--z-tooltip)' }}
    >
      {t.shell.skipToContent}
    </a>
  );
}

/* ── Owner: rail + dense workstation ───────────────────── */

export function OwnerShell() {
  const tickets = useStore((s) => s.tickets);
  const threads = useStore((s) => s.threads);
  const leads = useStore((s) => s.leads);
  const properties = useStore((s) => s.properties);
  const inquiries = useStore((s) => s.inquiries);
  const seasonalTasks = useStore((s) => s.seasonalTasks);
  const main = React.useRef<HTMLElement>(null!);
  useScrollReset(main);

  const openTickets = tickets.filter((tk) => OPEN_TICKET_STATUSES.includes(tk.status)).length;
  const unread = threads.filter((th) => th.messages.some((m) => !m.read)).length;
  const waitingInquiries = inquiries.filter(
    (x) => x.status === 'new' || x.status === 'answered',
  ).length;
  const dueSoon = seasonalTasks.filter(
    (x) => x.status === 'due' && daysUntil(x.due_date) <= 45,
  ).length;

  const items: NavItem[] = [
    { to: '/owner', label: t.ownerNav.dashboard, Icon: Gauge, end: true },
    { to: '/owner/properties', label: t.ownerNav.properties, Icon: Home, count: properties.length },
    { to: '/owner/tickets', label: t.ownerNav.tickets, Icon: Wrench, count: openTickets },
    { to: '/owner/maintenance', label: t.ownerNav.maintenance, Icon: CalendarClock, count: dueSoon },
    { to: '/owner/crm', label: t.ownerNav.crm, Icon: Users, count: leads.length },
    { to: '/owner/inquiries', label: t.ownerNav.inquiries, Icon: MessageCircleQuestion, count: waitingInquiries },
    { to: '/owner/vendors', label: t.ownerNav.vendors, Icon: ListChecks },
    { to: '/owner/contracts', label: t.ownerNav.contracts, Icon: FileSignature },
    { to: '/owner/finance', label: t.ownerNav.finance, Icon: Banknote },
    { to: '/owner/revenue', label: t.ownerNav.revenue, Icon: Coins },
    { to: '/owner/messages', label: t.ownerNav.messages, Icon: Inbox, count: unread },
  ];

  /* Bottom nav caps at five: dashboard, portfolio, tickets, leads, inquiries.
     Everything else stays reachable from the dashboard and the rail. */
  const mobileItems = items.filter((i) =>
    ['/owner', '/owner/properties', '/owner/tickets', '/owner/crm', '/owner/inquiries'].includes(i.to),
  );

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <SkipLink />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t.shell.mainNav}
          className="hidden w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-s border-line bg-surface p-2.5 md:flex"
        >
          {items.map((item) => (
            <RailLink key={item.to} item={item} />
          ))}
        </nav>
        <main ref={main} id="main" className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[92rem] px-4 py-5 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomTabs items={mobileItems} />
      <Toaster />
    </div>
  );
}

/* ── Tenant: no rail, five large destinations ──────────── */

export function TenantShell() {
  const tickets = useStore((s) => s.tickets);
  const currentTenantId = useStore((s) => s.currentTenantId);
  const main = React.useRef<HTMLElement>(null!);
  useScrollReset(main);

  const open = tickets.filter(
    (tk) => tk.tenant_id === currentTenantId && OPEN_TICKET_STATUSES.includes(tk.status),
  ).length;

  const items: NavItem[] = [
    { to: '/tenant', label: t.tenantNav.home, Icon: Home, end: true },
    { to: '/tenant/report', label: t.tenantNav.report, Icon: Wrench },
    { to: '/tenant/tickets', label: t.tenantNav.tickets, Icon: ListChecks, count: open },
    { to: '/tenant/renewal', label: t.tenantNav.renewal, Icon: CalendarCheck2 },
    { to: '/tenant/documents', label: t.tenantNav.documents, Icon: FileText },
  ];

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <SkipLink />
      <TopBar />
      <TopNav items={items} />
      <main ref={main} id="main" className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <Outlet />
        </div>
      </main>
      <BottomTabs items={items} />
      <Toaster />
    </div>
  );
}

/* ── Seeker: no chrome in the way of the map ───────────── */

export function SeekerShell() {
  const leads = useStore((s) => s.leads);
  const currentSeekerId = useStore((s) => s.currentSeekerId);
  const main = React.useRef<HTMLElement>(null!);
  useScrollReset(main);

  const queued = leads.filter((l) => l.seeker_id === currentSeekerId && !l.watch_only).length;

  const items: NavItem[] = [
    { to: '/search', label: t.seekerNav.search, Icon: Search, end: true },
    { to: '/search/queue', label: t.seekerNav.queue, Icon: MapPin, count: queued },
    { to: '/search/profile', label: t.seekerNav.profile, Icon: Users },
  ];

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <SkipLink />
      <TopBar />
      <TopNav items={items} />
      <main ref={main} id="main" className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomTabs items={items} />
      <Toaster />
    </div>
  );
}
