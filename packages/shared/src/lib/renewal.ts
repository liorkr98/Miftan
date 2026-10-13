/**
 * Lease turnover — when a lease ends, what happens next, and whose turn it is.
 *
 * Pure, so the API, the screens and the notification feed cannot disagree
 * about the state of a lease. Every "what should I do now" question in the
 * product is answered by `nextStep`, from facts stored on the cycle.
 */

/** Never start the conversation later than three months before the end. */
export const RENEWAL_DEFAULT_LEAD_DAYS = 90;
/** When the contract has a notice period, start a month before it bites. */
export const RENEWAL_NOTICE_BUFFER_DAYS = 30;
/** If the owner says nothing, the search for the next tenant starts anyway. */
export const APPLICANTS_AUTO_OPEN_HOURS = 48;
/** A renewal signing takes longer than a viewing. */
export const MEETING_MINUTES = 30;
/** Apartment viewings, back to back. */
export const VIEWING_MINUTES = 15;

export type RenewalStage =
  /** Not open yet — nothing to do */
  | 'upcoming'
  | 'awaiting_tenant'
  /** The tenant asked; the owner has not answered */
  | 'questions'
  /** The owner answered; the tenant has a deadline */
  | 'answered'
  | 'staying'
  | 'leaving'
  | 'renewed'
  /** A new tenant has signed — the turnover is over */
  | 'closed';

export type RenewalTopic = 'rent_same' | 'extend_year' | 'shorter' | 'terms_change' | 'other';
export const RENEWAL_TOPICS: RenewalTopic[] = ['rent_same', 'extend_year', 'shorter', 'terms_change'];

export type OwnerStep =
  | 'answer_questions'
  | 'tenant_overdue'
  | 'offer_meeting_times'
  | 'confirm_renewal'
  | 'review_requirements'
  | 'set_viewing_times'
  | 'review_applicants';

export type TenantStep = 'decide' | 'pick_meeting_time';

/** What the screen says while it is somebody else's turn. */
export type WaitingOn =
  | 'not_open'
  | 'tenant'
  | 'owner_answers'
  | 'owner_times'
  | 'tenant_time'
  | 'meeting'
  | 'applicants'
  | 'done';

export interface CycleFacts {
  stage: RenewalStage;
  overdue: boolean;
  meetingSlotsOpen: number;
  meetingBooked: boolean;
  /** The booked signing time has passed */
  meetingPast: boolean;
  requirementsConfirmed: boolean;
  applicantsOpen: boolean;
  applicants: number;
  viewingSlotsFuture: number;
}

const DAY = 86_400_000;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The day the system asks the tenant. Three months before the end, or a month
 * before the contract's notice deadline when that comes earlier — the
 * conversation has to start before the tenant is legally late to answer it.
 */
export function renewalOpensOn(endDate: string, noticePeriodDays: number | null): string {
  const lead = Math.max(RENEWAL_DEFAULT_LEAD_DAYS, (noticePeriodDays ?? 0) + RENEWAL_NOTICE_BUFFER_DAYS);
  return addDays(endDate, -lead);
}

/** The contract's own deadline for saying whether you stay. */
export function noticeDeadline(endDate: string, noticePeriodDays: number | null): string {
  return addDays(endDate, -(noticePeriodDays && noticePeriodDays > 0 ? noticePeriodDays : 30));
}

/** The first day of the next tenancy. */
export function nextMoveIn(endDate: string): string {
  return addDays(endDate, 1);
}

/** The same lease again, for as long as the contract says, or a year. */
export function defaultRenewedEnd(endDate: string, extensionMonths: number | null): string {
  const d = new Date(`${endDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + (extensionMonths && extensionMonths > 0 ? extensionMonths : 12));
  return d.toISOString().slice(0, 10);
}

export function applicantsOpenAt(leavingAt: Date, requirementsConfirmedAt: Date | null): Date {
  return requirementsConfirmedAt ?? new Date(leavingAt.getTime() + APPLICANTS_AUTO_OPEN_HOURS * 3_600_000);
}

/** Whose turn is it, and what is the one thing they should do. */
export function nextStep(f: CycleFacts): { owner: OwnerStep | null; tenant: TenantStep | null; waitingOn: WaitingOn } {
  switch (f.stage) {
    case 'upcoming':
      return { owner: null, tenant: null, waitingOn: 'not_open' };
    case 'awaiting_tenant':
      return { owner: f.overdue ? 'tenant_overdue' : null, tenant: 'decide', waitingOn: 'tenant' };
    case 'questions':
      return { owner: 'answer_questions', tenant: null, waitingOn: 'owner_answers' };
    case 'answered':
      return { owner: f.overdue ? 'tenant_overdue' : null, tenant: 'decide', waitingOn: 'tenant' };
    case 'staying':
      if (f.meetingBooked) {
        return { owner: f.meetingPast ? 'confirm_renewal' : null, tenant: null, waitingOn: 'meeting' };
      }
      if (f.meetingSlotsOpen > 0) return { owner: null, tenant: 'pick_meeting_time', waitingOn: 'tenant_time' };
      return { owner: 'offer_meeting_times', tenant: null, waitingOn: 'owner_times' };
    case 'leaving':
      if (!f.requirementsConfirmed && !f.applicantsOpen) {
        return { owner: 'review_requirements', tenant: null, waitingOn: 'applicants' };
      }
      if (f.applicants > 0 && f.viewingSlotsFuture === 0) {
        return { owner: 'set_viewing_times', tenant: null, waitingOn: 'applicants' };
      }
      if (f.applicants > 0) return { owner: 'review_applicants', tenant: null, waitingOn: 'applicants' };
      return { owner: null, tenant: null, waitingOn: 'applicants' };
    case 'renewed':
    case 'closed':
      return { owner: null, tenant: null, waitingOn: 'done' };
  }
}

/**
 * Cut an availability window into back-to-back slots. A window of 17:00–19:00
 * at 15 minutes is eight viewings; the owner never types each one.
 */
export function splitWindow(from: string, until: string, minutes: number): string[] {
  const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const out: string[] = [];
  for (let m = toMin(from); m + minutes <= toMin(until); m += minutes) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}
