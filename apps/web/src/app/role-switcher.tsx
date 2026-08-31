import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { t, type Capabilities } from '@miftan/shared';
import { cn } from '@/lib/utils';
import { horizontalKeyDelta } from '@/lib/rtl';
import { Building2, KeyRound, Search } from 'lucide-react';

/**
 * What replaced the persona switcher.
 *
 * The old control let anyone become anyone, because there were no accounts.
 * This one only offers roles the signed-in account actually holds: owning a
 * property, holding a live lease, queueing on a listing. A landlord who also
 * rents somewhere sees two tabs; most people see none and never know the
 * control exists.
 *
 * The capabilities come from the server, so this cannot be used to reach a
 * view the account is not entitled to — picking a tab changes the route, and
 * every route re-checks scope on its own.
 */

export type Role = 'owner' | 'tenant' | 'seeker';

const ROLES: { id: Role; label: string; root: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'owner', label: t.roles.owner, root: '/owner', Icon: Building2 },
  { id: 'tenant', label: t.roles.tenant, root: '/tenant', Icon: KeyRound },
  { id: 'seeker', label: t.roles.seeker, root: '/search', Icon: Search },
];

export function rolesFor(capabilities: Capabilities | null): Role[] {
  if (!capabilities) return [];
  const roles: Role[] = [];
  if (capabilities.isOwner) roles.push('owner');
  if (capabilities.isTenant) roles.push('tenant');
  /* Anyone signed in may browse the market, whether or not they are queueing
     — searching is what turns a person into a seeker, not the other way round. */
  roles.push('seeker');
  return roles;
}

export function roleFromPath(pathname: string): Role | null {
  if (pathname.startsWith('/owner')) return 'owner';
  if (pathname.startsWith('/tenant')) return 'tenant';
  if (pathname.startsWith('/search')) return 'seeker';
  return null;
}

export function RoleSwitcher({ capabilities }: { capabilities: Capabilities | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const available = rolesFor(capabilities);
  const current = roleFromPath(location.pathname);
  const shown = ROLES.filter((r) => available.includes(r.id));

  /* One role is not a choice, so it is not a control. */
  if (shown.length < 2) return null;

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = horizontalKeyDelta(event.key);
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + shown.length) % shown.length;
    refs.current[next]?.focus();
    navigate(shown[next].root);
  };

  return (
    <div
      role="tablist"
      aria-label={t.roles.switch}
      className="flex items-center gap-0.5 rounded-full bg-white/10 p-1 ring-1 ring-inset ring-white/10"
    >
      {shown.map((role, i) => {
        const active = current === role.id;
        return (
          <button
            key={role.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => navigate(role.root)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'press-sm flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
              'transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)]',
              active ? 'bg-on-ink text-ink' : 'text-on-ink-muted hover:bg-white/10 hover:text-on-ink',
            )}
          >
            <role.Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{role.label}</span>
          </button>
        );
      })}
    </div>
  );
}
