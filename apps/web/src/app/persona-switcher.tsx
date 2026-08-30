import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '@/data/store';
import { t, type Persona } from '@miftan/shared';
import { cn } from '@/lib/utils';
import { horizontalKeyDelta } from '@/lib/rtl';
import { Building2, KeyRound, Search } from 'lucide-react';

const PERSONAS: { id: Persona; label: string; short: string; root: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'owner', label: t.persona.owner, short: t.persona.ownerShort, root: '/owner', Icon: Building2 },
  { id: 'tenant', label: t.persona.tenant, short: t.persona.tenantShort, root: '/tenant', Icon: KeyRound },
  { id: 'seeker', label: t.persona.seeker, short: t.persona.seekerShort, root: '/search', Icon: Search },
];

/**
 * The demo's most important control, so it gets the only pill shape in the
 * top bar and nothing competes with it there.
 *
 * Switching persona routes to that persona's root rather than mapping to an
 * "equivalent" screen — there is no equivalence between a portfolio board
 * and a search map, and pretending otherwise would be a lie about the product.
 */
export function PersonaSwitcher({ className }: { className?: string }) {
  const persona = useStore((s) => s.persona);
  const setPersona = useStore((s) => s.setPersona);
  const navigate = useNavigate();
  const location = useLocation();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  /* Deep links are the source of truth: /tenant/report sets the persona. */
  React.useEffect(() => {
    const path = location.pathname;
    const next: Persona | null = path.startsWith('/owner')
      ? 'owner'
      : path.startsWith('/tenant')
        ? 'tenant'
        : path.startsWith('/search')
          ? 'seeker'
          : null;
    if (next && next !== persona) setPersona(next);
  }, [location.pathname, persona, setPersona]);

  const go = (p: (typeof PERSONAS)[number]) => {
    setPersona(p.id);
    navigate(p.root);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = horizontalKeyDelta(event.key);
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + PERSONAS.length) % PERSONAS.length;
    refs.current[next]?.focus();
    go(PERSONAS[next]);
  };

  return (
    <div
      role="tablist"
      aria-label={t.shell.personaSwitcher}
      className={cn(
        'flex items-center gap-0.5 rounded-full bg-white/10 p-1 ring-1 ring-inset ring-white/10',
        className,
      )}
    >
      {PERSONAS.map((p, i) => {
        const active = persona === p.id;
        return (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => go(p)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors duration-150 ease-[var(--ease-out-quart)]',
              active
                ? 'bg-on-ink text-ink'
                : 'text-on-ink-muted hover:bg-white/10 hover:text-on-ink',
            )}
          >
            <p.Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{p.label}</span>
            <span className="sm:hidden">{p.short}</span>
          </button>
        );
      })}
    </div>
  );
}
