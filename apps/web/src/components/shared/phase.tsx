import { t, type PropertyPhase, type Turn } from '@miftan/shared';
import {
  BadgeCheck,
  CalendarCheck2,
  CalendarClock,
  CircleCheck,
  CircleDot,
  DoorOpen,
  Eye,
  Hammer,
  Hourglass,
  LogOut,
  RefreshCw,
  Search,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * A flat's phase, as a chip. Every phase carries an icon and a word, so the
 * colour only ever repeats what the text already says.
 */
const PHASE: Record<PropertyPhase, { Icon: LucideIcon; tone: BadgeProps['tone'] }> = {
  stable: { Icon: CircleCheck, tone: 'neutral' },
  renewal_soon: { Icon: CalendarClock, tone: 'signalSoft' },
  renewal: { Icon: RefreshCw, tone: 'liveSoft' },
  renewal_agreed: { Icon: CalendarCheck2, tone: 'liveSoft' },
  renewed: { Icon: BadgeCheck, tone: 'openSoft' },
  leaving: { Icon: LogOut, tone: 'signalSoft' },
  searching: { Icon: Search, tone: 'openSoft' },
  viewings: { Icon: Eye, tone: 'openSoft' },
  vacant: { Icon: DoorOpen, tone: 'outline' },
  renovating: { Icon: Hammer, tone: 'neutral' },
};

export function PhaseChip({ phase, size = 'md', className }: { phase: PropertyPhase; size?: 'sm' | 'md'; className?: string }) {
  const { Icon, tone } = PHASE[phase];
  return (
    <Badge tone={tone} size={size} className={className}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      {t.lifecycle.phase[phase]}
    </Badge>
  );
}

const TURN: Record<Exclude<Turn, null>, LucideIcon> = {
  you: CircleDot,
  tenant: Hourglass,
  applicants: Users,
};

/** Whose move it is. "Yours" is the one filled marker on the screen; the others stay quiet. */
export function TurnBadge({ turn, size = 'md', className }: { turn: Turn; size?: 'sm' | 'md'; className?: string }) {
  if (!turn) return null;
  const Icon = TURN[turn];
  return (
    <Badge tone={turn === 'you' ? 'ink' : 'outline'} size={size} className={cn(className)}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      {t.lifecycle.turn[turn]}
    </Badge>
  );
}
