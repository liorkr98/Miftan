import { describe, expect, it } from 'vitest';
import { propertyPhase, type PhaseFacts } from '../lib/lifecycle';

const base: PhaseFacts = { status: 'occupied', listed: true, renewal: null, snapshot: null, today: '2026-10-14' };
const renewal = (over: Partial<NonNullable<PhaseFacts['renewal']>>): NonNullable<PhaseFacts['renewal']> => ({
  stage: 'awaiting_tenant',
  ownerStep: null,
  waitingOn: 'tenant',
  meeting: null,
  opensOn: '2026-10-01',
  replacement: null,
  ...over,
});
const snap = (over: Partial<NonNullable<PhaseFacts['snapshot']>> = {}): NonNullable<PhaseFacts['snapshot']> => ({
  applicants: 0,
  relevantWithoutViewing: 0,
  upcomingViewings: 0,
  openSlots: 0,
  ...over,
});
const replacement = (applicantsOpen: boolean) =>
  ({ applicantsOpen }) as unknown as NonNullable<NonNullable<PhaseFacts['renewal']>['replacement']>;

describe('propertyPhase', () => {
  it('a running lease with nothing open is stable', () => {
    expect(propertyPhase(base)).toEqual({ phase: 'stable', turn: null });
  });

  it('flags a renewal opening within 30 days, and not one further off', () => {
    expect(propertyPhase({ ...base, renewal: renewal({ stage: 'upcoming', opensOn: '2026-11-05' }) }).phase).toBe('renewal_soon');
    expect(propertyPhase({ ...base, renewal: renewal({ stage: 'upcoming', opensOn: '2027-05-01' }) }).phase).toBe('stable');
  });

  it('says whose turn a renewal is', () => {
    expect(propertyPhase({ ...base, renewal: renewal({ stage: 'questions', ownerStep: 'answer_questions' }) })).toEqual({ phase: 'renewal', turn: 'you' });
    expect(propertyPhase({ ...base, renewal: renewal({ stage: 'answered' }) })).toEqual({ phase: 'renewal', turn: 'tenant' });
  });

  it('a booked signing meeting is its own phase', () => {
    const meeting = { id: 'm', startsAt: '2026-10-16T14:00:00Z', durationMinutes: 30, status: 'booked' as const, bookedAt: null };
    expect(propertyPhase({ ...base, renewal: renewal({ stage: 'staying', meeting }) })).toEqual({ phase: 'renewal_agreed', turn: null });
  });

  it('leaving → searching → viewings as the search opens and people book', () => {
    const leaving = renewal({ stage: 'leaving', ownerStep: 'review_requirements', replacement: replacement(false) });
    expect(propertyPhase({ ...base, status: 'vacating', renewal: leaving })).toEqual({ phase: 'leaving', turn: 'you' });

    const open = renewal({ stage: 'leaving', replacement: replacement(true) });
    expect(propertyPhase({ ...base, status: 'vacating', renewal: open, snapshot: snap({ applicants: 3, relevantWithoutViewing: 2 }) }))
      .toEqual({ phase: 'searching', turn: 'you' });
    expect(propertyPhase({ ...base, status: 'vacating', renewal: open, snapshot: snap({ applicants: 3, upcomingViewings: 2, openSlots: 4 }) }))
      .toEqual({ phase: 'viewings', turn: 'applicants' });
  });

  it('vacant flats: listed is a search, unlisted needs the owner', () => {
    expect(propertyPhase({ ...base, status: 'vacant', listed: true, snapshot: snap() })).toEqual({ phase: 'searching', turn: null });
    expect(propertyPhase({ ...base, status: 'vacant', listed: false })).toEqual({ phase: 'vacant', turn: 'you' });
  });

  it('renovation wins over everything', () => {
    expect(propertyPhase({ ...base, status: 'renovating', renewal: renewal({ stage: 'questions', ownerStep: 'answer_questions' }) }).phase).toBe('renovating');
  });
});
