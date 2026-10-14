import type { RenewalView } from '../api/renewals';
import type { PropertySnapshot } from '../api/portfolio';

/**
 * Where a flat is in its life, in one word — and whose move it is.
 *
 * The portfolio list, the property page and the attention list all ask this,
 * so it is answered once. Two separate facts, on purpose: *what is happening*
 * (the phase) and *who has to act* (the turn). "Renewal in progress" can be
 * waiting on the tenant or on you; a search can be waiting on applicants or on
 * you; and an owner scanning a list needs to see both at once.
 */

export type PropertyPhase =
  /** A lease running, nothing to do. */
  | 'stable'
  /** The renewal conversation opens within 30 days. */
  | 'renewal_soon'
  /** Open: asked, asking questions, deciding, or agreeing a time. */
  | 'renewal'
  /** Staying, and the signing meeting is booked. */
  | 'renewal_agreed'
  | 'renewed'
  /** Leaving; the search has not opened yet. */
  | 'leaving'
  /** Listed and taking applications; no viewing booked ahead. */
  | 'searching'
  /** Searching, with viewings booked. */
  | 'viewings'
  /** Empty and not listed. */
  | 'vacant'
  | 'renovating';

export type Turn = 'you' | 'tenant' | 'applicants' | null;

export interface PhaseFacts {
  status: 'occupied' | 'vacant' | 'vacating' | 'renovating';
  listed: boolean;
  renewal: Pick<RenewalView, 'stage' | 'ownerStep' | 'waitingOn' | 'meeting' | 'opensOn' | 'replacement'> | null;
  snapshot: Pick<PropertySnapshot, 'applicants' | 'relevantWithoutViewing' | 'upcomingViewings' | 'openSlots'> | null;
  today: string;
}

export interface PhaseResult {
  phase: PropertyPhase;
  turn: Turn;
}

/** The search's own turn: times needed, or simply waiting for people to book. */
function searchTurn(snapshot: PhaseFacts['snapshot']): Turn {
  if (!snapshot) return null;
  if (snapshot.relevantWithoutViewing > 0 && snapshot.openSlots === 0) return 'you';
  if (snapshot.applicants > 0 || snapshot.openSlots > 0) return 'applicants';
  return null;
}

export function propertyPhase(f: PhaseFacts): PhaseResult {
  if (f.status === 'renovating') return { phase: 'renovating', turn: null };

  const r = f.renewal;
  if (r) {
    switch (r.stage) {
      case 'renewed':
        return { phase: 'renewed', turn: null };
      case 'leaving': {
        if (!r.replacement?.applicantsOpen) return { phase: 'leaving', turn: r.ownerStep ? 'you' : null };
        const phase = (f.snapshot?.upcomingViewings ?? 0) > 0 ? 'viewings' : 'searching';
        return { phase, turn: searchTurn(f.snapshot) };
      }
      case 'staying':
        if (r.meeting) return { phase: 'renewal_agreed', turn: r.ownerStep ? 'you' : null };
        return { phase: 'renewal', turn: r.ownerStep ? 'you' : 'tenant' };
      case 'awaiting_tenant':
      case 'questions':
      case 'answered':
        return { phase: 'renewal', turn: r.ownerStep ? 'you' : 'tenant' };
      case 'upcoming':
        if ((Date.parse(r.opensOn) - Date.parse(f.today)) / 86_400_000 <= 30) return { phase: 'renewal_soon', turn: null };
        break;
      case 'closed':
        break;
    }
  }

  if (f.status === 'vacant') {
    if (!f.listed) return { phase: 'vacant', turn: 'you' };
    const phase = (f.snapshot?.upcomingViewings ?? 0) > 0 ? 'viewings' : 'searching';
    return { phase, turn: searchTurn(f.snapshot) };
  }
  if (f.status === 'vacating') return { phase: 'leaving', turn: null };
  return { phase: 'stable', turn: null };
}

/** Phases where a calendar belongs on the property page. */
export const SCHEDULING_PHASES: readonly PropertyPhase[] = ['renewal', 'renewal_agreed', 'searching', 'viewings'];

/** Phases where applicants are the main story. */
export const DEMAND_PHASES: readonly PropertyPhase[] = ['leaving', 'searching', 'viewings'];
