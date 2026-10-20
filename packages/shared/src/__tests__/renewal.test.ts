import { describe, expect, it } from 'vitest';
import {
  applicantsOpenAt,
  defaultRenewedEnd,
  nextStep,
  noticeDeadline,
  renewalOpensOn,
  splitWindow,
  type CycleFacts,
} from '../lib/renewal';
import { effectiveCriteria, evaluateLead, DEFAULT_CRITERIA } from '../lib/screening';
import type { Lead, Property } from '../types';

const facts = (over: Partial<CycleFacts>): CycleFacts => ({
  stage: 'awaiting_tenant', overdue: false, meetingSlotsOpen: 0, meetingBooked: false, meetingPast: false,
  requirementsConfirmed: false, applicantsOpen: false, applicants: 0, viewingSlotsFuture: 0, ...over,
});

describe('when renewal opens', () => {
  it('defaults to three months before the end', () => {
    expect(renewalOpensOn('2027-03-31', null)).toBe('2026-12-31');
  });
  it('starts a month before a long notice period bites', () => {
    expect(renewalOpensOn('2027-03-31', 120)).toBe('2026-11-01');
  });
  it('never later than three months, even with a short notice period', () => {
    expect(renewalOpensOn('2027-03-31', 30)).toBe('2026-12-31');
  });
  it('reads the notice deadline from the contract', () => {
    expect(noticeDeadline('2027-03-31', 60)).toBe('2027-01-30');
  });
  it('renews for the contract extension, or a year', () => {
    expect(defaultRenewedEnd('2027-03-31', 6)).toBe('2027-10-01');
    expect(defaultRenewedEnd('2027-03-31', null)).toBe('2028-03-31');
  });
});

describe('whose turn it is', () => {
  it('asks the tenant, and the owner only once the tenant is late', () => {
    expect(nextStep(facts({}))).toMatchObject({ tenant: 'decide', owner: null });
    expect(nextStep(facts({ overdue: true }))).toMatchObject({ tenant: 'decide', owner: 'tenant_overdue' });
  });
  it('puts questions on the owner', () => {
    expect(nextStep(facts({ stage: 'questions' }))).toMatchObject({ owner: 'answer_questions', tenant: null });
  });
  it('walks a staying tenant through times, booking and confirmation', () => {
    expect(nextStep(facts({ stage: 'staying' })).owner).toBe('offer_meeting_times');
    expect(nextStep(facts({ stage: 'staying', meetingSlotsOpen: 3 })).tenant).toBe('pick_meeting_time');
    expect(nextStep(facts({ stage: 'staying', meetingBooked: true }))).toMatchObject({ owner: null, waitingOn: 'meeting' });
    expect(nextStep(facts({ stage: 'staying', meetingBooked: true, meetingPast: true })).owner).toBe('confirm_renewal');
  });
  it('walks a leaving tenant through requirements, viewings and applicants', () => {
    expect(nextStep(facts({ stage: 'leaving' })).owner).toBe('review_requirements');
    expect(nextStep(facts({ stage: 'leaving', applicantsOpen: true })).owner).toBeNull();
    expect(nextStep(facts({ stage: 'leaving', applicantsOpen: true, applicants: 2 })).owner).toBe('set_viewing_times');
    expect(nextStep(facts({ stage: 'leaving', applicantsOpen: true, applicants: 2, viewingSlotsFuture: 4 })).owner).toBe('review_applicants');
  });
  it('opens the search on its own if the owner says nothing for two days', () => {
    const at = new Date('2026-10-01T10:00:00Z');
    expect(applicantsOpenAt(at, null).toISOString()).toBe('2026-10-03T10:00:00.000Z');
  });
});

describe('splitWindow', () => {
  it('cuts 17:00–19:00 into eight fifteen-minute viewings', () => {
    expect(splitWindow('17:00', '19:00', 15)).toEqual([
      '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45',
    ]);
  });
  it('drops a tail too short for a whole slot', () => {
    expect(splitWindow('18:00', '20:20', 30)).toEqual(['18:00', '18:30', '19:00', '19:30']);
  });
});

describe('per-apartment requirements', () => {
  const property = (over: Partial<Property> = {}): Property => ({
    id: 'p', owner_id: 'o', address: { street: 's', number: '1', city: 'c', neighborhood: 'n', lat: 0, lng: 0 },
    rooms: 3, sqm: 70, floor: 1, total_floors: 3, amenities: [], photos: [], monthly_rent: 8000,
    arnona_bimonthly: 0, vaad_monthly: 0, status: 'occupied', availability_confidence: 'confirmed', listed: true, ...over,
  });
  const lead = (over: Partial<Lead['screening']> = {}): Lead => ({
    id: 'l', property_id: 'p', seeker_id: 's', stage: 'new', created_at: '2026-01-01', desired_move_in: '2026-11-01',
    queue_position: 1, screening_flags: [],
    screening: {
      income_to_rent_ratio: 4, employment: 'salaried', has_guarantors: true, occupants: 2, pets: false,
      smoker: true, lease_length_months: 12, prior_landlord_reference: true, ...over,
    },
  });

  it('turns smoking on for this apartment even if the preset leaves it off', () => {
    const p = property({ smoking_allowed: false });
    const flags = evaluateLead(lead(), p, effectiveCriteria(DEFAULT_CRITERIA, p));
    expect(flags.find((f) => f.criterion === 'smoking')?.passed).toBe(false);
  });

  it('uses the apartment occupancy cap and minimum lease', () => {
    const p = property({ max_occupants: 1, min_lease_months: 24 });
    const flags = evaluateLead(lead({ smoker: false }), p, effectiveCriteria(DEFAULT_CRITERIA, p));
    expect(flags.find((f) => f.criterion === 'occupancy')?.passed).toBe(false);
    expect(flags.find((f) => f.criterion === 'lease_length')?.passed).toBe(false);
  });

  it('leaves the preset alone when the apartment sets nothing', () => {
    expect(effectiveCriteria(DEFAULT_CRITERIA, property())).toEqual(DEFAULT_CRITERIA);
  });
});
