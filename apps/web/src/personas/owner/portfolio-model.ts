import * as React from 'react';
import {
  t,
  daysUntil,
  formatDate,
  formatDateTime,
  formatTime,
  israelToday,
  propertyPhase,
  type Appointment,
  type OwnerProperty,
  type PropertyPhase,
  type PropertySnapshot,
  type RenewalView,
  type Turn,
} from '@miftan/shared';
import { useInquiries, usePortfolioSnapshot, useProperties, useRenewals } from '@/api/hooks';
import { useNow } from '@/lib/use-now';

/**
 * The owner's portfolio as one model: every flat with its phase and whose
 * turn it is, the things waiting on the owner in order of urgency, and the
 * headline totals. The activity page, the dashboard and the property page all
 * read it, so a flat cannot be "waiting for you" on one screen and calm on
 * another.
 */

export interface PortfolioRow {
  property: OwnerProperty;
  label: string;
  renewal: RenewalView | null;
  snapshot: PropertySnapshot | null;
  phase: PropertyPhase;
  turn: Turn;
}

export interface AttentionItem {
  id: string;
  /** Higher first. */
  urgency: number;
  urgent: boolean;
  title: string;
  detail: string;
  action: string;
  href: string;
  propertyId: string | null;
}

export type ListFilter = 'all' | 'attention' | 'renewal' | 'applicants' | 'viewings' | 'alerts';

export const RENEWAL_PHASES: readonly PropertyPhase[] = ['renewal_soon', 'renewal', 'renewal_agreed'];

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

const labelOf = (p: OwnerProperty) => `${p.address.street} ${p.address.number}`;

/** The renewal that describes the flat now: an open cycle beats a closed one. */
function currentRenewal(renewals: RenewalView[], propertyId: string): RenewalView | null {
  const mine = renewals.filter((r) => r.role === 'owner' && r.propertyId === propertyId && r.stage !== 'closed');
  return mine[0] ?? null;
}

export function rowFor(property: OwnerProperty, renewals: RenewalView[], snapshot: PropertySnapshot | null): PortfolioRow {
  const renewal = currentRenewal(renewals, property.id);
  const { phase, turn } = propertyPhase({
    status: property.status,
    listed: property.listed,
    renewal,
    snapshot,
    today: israelToday(),
  });
  return { property, label: labelOf(property), renewal, snapshot, phase, turn };
}

function attentionFor(rows: PortfolioRow[], agenda: Appointment[], waitingInquiries: number, now: number): AttentionItem[] {
  const A = t.activity.attention.items;
  const items: AttentionItem[] = [];
  const page = (id: string, query = '') => `/owner/properties/${id}${query}`;

  for (const row of rows) {
    const { renewal: r, snapshot: snap, property: p, label } = row;
    const tenant = r?.counterpartName ?? p.tenant?.name ?? '';

    switch (r?.ownerStep) {
      case 'tenant_overdue':
        items.push({ id: `${p.id}-overdue`, urgency: 100, urgent: true, title: fill(A.overdue.title, { tenant }), detail: fill(A.overdue.detail, { label }), action: A.overdue.action, href: page(p.id), propertyId: p.id });
        break;
      case 'answer_questions': {
        const q = r.questions[0];
        const question = q ? (q.topic === 'other' ? q.text ?? '' : t.turnover.topics[q.topic]) : '';
        const hours = r.questionsAt ? (now - Date.parse(r.questionsAt)) / 3_600_000 : 0;
        items.push({ id: `${p.id}-questions`, urgency: 90, urgent: hours > 24, title: fill(A.questions.title, { tenant }), detail: fill(A.questions.detail, { question, label }), action: A.questions.action, href: page(p.id, '?do=answers'), propertyId: p.id });
        break;
      }
      case 'review_requirements': {
        const opensAt = r.replacement?.applicantsOpenAt;
        const soon = opensAt ? Date.parse(opensAt) - now < 24 * 3_600_000 : false;
        items.push({ id: `${p.id}-leaving`, urgency: 85, urgent: soon, title: fill(A.leaving.title, { tenant, label }), detail: fill(A.leaving.detail, { when: opensAt ? formatDateTime(opensAt) : '' }), action: A.leaving.action, href: page(p.id, '?do=requirements'), propertyId: p.id });
        break;
      }
      case 'confirm_renewal':
        items.push({ id: `${p.id}-confirm`, urgency: 80, urgent: false, title: fill(A.confirm.title, { tenant }), detail: fill(A.confirm.detail, { label }), action: A.confirm.action, href: page(p.id, '?do=complete'), propertyId: p.id });
        break;
      case 'offer_meeting_times':
        items.push({ id: `${p.id}-times`, urgency: 78, urgent: false, title: fill(A.offerTimes.title, { tenant, label }), detail: A.offerTimes.detail, action: A.offerTimes.action, href: page(p.id, '?do=meeting'), propertyId: p.id });
        break;
      default:
        break;
    }

    if (row.phase === 'renewal_soon' && r) {
      const n = Math.max(0, daysUntil(r.lease.endDate));
      items.push({ id: `${p.id}-soon`, urgency: 40, urgent: false, title: fill(A.soon.title, { label, n }), detail: fill(A.soon.detail, { tenant, date: formatDate(r.opensOn) }), action: A.soon.action, href: page(p.id), propertyId: p.id });
    }

    if (snap && (row.phase === 'searching' || row.phase === 'viewings')) {
      if (snap.relevantWithoutViewing > 0 && snap.openSlots === 0) {
        const n = snap.relevantWithoutViewing;
        items.push({ id: `${p.id}-needtimes`, urgency: 70, urgent: false, title: n === 1 ? fill(A.needTimes.one, { label }) : fill(A.needTimes.title, { n, label }), detail: A.needTimes.detail, action: A.needTimes.action, href: page(p.id, '?tab=schedule&add=1'), propertyId: p.id });
      } else if (snap.newRelevant > 0) {
        const n = snap.newRelevant;
        items.push({ id: `${p.id}-new`, urgency: 60, urgent: false, title: n === 1 ? fill(A.newApplicants.one, { label }) : fill(A.newApplicants.title, { n, label }), detail: A.newApplicants.detail, action: A.newApplicants.action, href: page(p.id, '?tab=leads'), propertyId: p.id });
      }
    }
  }

  const today = israelToday();
  const todays = agenda.filter((a) => israelToday(new Date(a.startsAt)) === today && Date.parse(a.startsAt) > now);
  if (todays.length) {
    const first = todays[0];
    items.push({
      id: 'today',
      urgency: 75,
      urgent: false,
      title: todays.length === 1 ? A.today.one : fill(A.today.title, { n: todays.length }),
      detail: fill(A.today.detail, { time: formatTime(first.startsAt), label: first.propertyLabel }),
      action: A.today.action,
      href: page(first.propertyId, '?tab=schedule'),
      propertyId: first.propertyId,
    });
  }

  if (waitingInquiries > 0) {
    items.push({
      id: 'inquiries',
      urgency: 55,
      urgent: false,
      title: waitingInquiries === 1 ? A.inquiries.one : fill(A.inquiries.title, { n: waitingInquiries }),
      detail: A.inquiries.detail,
      action: A.inquiries.action,
      href: '/owner/leads?tab=inquiries',
      propertyId: null,
    });
  }

  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.urgency - a.urgency);
}

export function usePortfolio(opts: { live?: boolean } = {}) {
  const properties = useProperties();
  const renewals = useRenewals({ live: opts.live });
  const snapshot = usePortfolioSnapshot({ live: opts.live });
  const { data: inquiries = [] } = useInquiries();
  const now = useNow();

  const model = React.useMemo(() => {
    const owned = (properties.data ?? []).filter((p): p is OwnerProperty => p.scope === 'owner');
    const snaps = new Map((snapshot.data?.properties ?? []).map((x) => [x.propertyId, x]));
    const rows = owned
      .map((p) => rowFor(p, renewals.data ?? [], snaps.get(p.id) ?? null))
      .sort((a, b) => Number(b.turn === 'you') - Number(a.turn === 'you') || a.label.localeCompare(b.label, 'he'));
    const agenda = snapshot.data?.agenda ?? [];
    const waitingInquiries = inquiries.filter((x) => x.scope === 'owner' && (x.status === 'new' || x.status === 'answered')).length;
    const attention = attentionFor(rows, agenda, waitingInquiries, now);

    const sum = (k: keyof Omit<PropertySnapshot, 'propertyId' | 'nextAppointmentAt'>) =>
      rows.reduce((acc, r) => acc + (r.snapshot?.[k] ?? 0), 0);
    const futureMeetings = (renewals.data ?? []).filter(
      (r) => r.role === 'owner' && r.meeting && Date.parse(r.meeting.startsAt) > now,
    ).length;

    return {
      rows,
      agenda,
      attention,
      totals: {
        active: rows.filter((r) => r.phase !== 'renovating' && (r.property.lease || r.property.listed)).length,
        needYou: rows.filter((r) => r.turn === 'you').length,
        renewals: rows.filter((r) => RENEWAL_PHASES.includes(r.phase)).length,
        renewalsInProgress: rows.filter((r) => r.phase === 'renewal' || r.phase === 'renewal_agreed').length,
        applicants: sum('applicants'),
        relevant: sum('relevant'),
        upcoming: sum('upcomingViewings') + futureMeetings,
        upcomingWeek: agenda.length,
        alerts: sum('alerts'),
      },
    };
  }, [properties.data, renewals.data, snapshot.data, inquiries, now]);

  return {
    ...model,
    isLoading: properties.isLoading || renewals.isLoading || snapshot.isLoading,
    isError: properties.isError || renewals.isError || snapshot.isError,
    refetch: () => {
      void properties.refetch();
      void renewals.refetch();
      void snapshot.refetch();
    },
  };
}

export function matchesFilter(row: PortfolioRow, filter: ListFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'attention':
      return row.turn === 'you';
    case 'renewal':
      return RENEWAL_PHASES.includes(row.phase);
    case 'applicants':
      return (row.snapshot?.applicants ?? 0) > 0;
    case 'viewings':
      return (row.snapshot?.upcomingViewings ?? 0) > 0 || Boolean(row.renewal?.meeting);
    case 'alerts':
      return (row.snapshot?.alerts ?? 0) > 0;
  }
}

/** One sentence: where the flat is and what comes next. */
export function rowSummary(row: PortfolioRow): string {
  const S = t.activity.list.summary;
  const p: OwnerProperty = row.property;
  const r = row.renewal;
  const tenant = r?.counterpartName ?? p.tenant?.name ?? '';
  const snap = row.snapshot;
  switch (row.phase) {
    case 'stable':
      return p.lease ? fill(S.stable, { tenant, date: formatDate(p.lease.endDate) }) : '';
    case 'renewal_soon':
      return fill(S.renewal_soon, { tenant, date: formatDate(r!.opensOn) });
    case 'renewal':
      if (r?.ownerStep) return fill(t.turnover.owner.steps2[r.ownerStep], { tenant });
      if (r?.stage === 'staying') return fill(S.renewalTime, { tenant });
      return fill(S.renewalWaiting, { tenant, date: r ? formatDateTime(r.answerBy) : '' });
    case 'renewal_agreed':
      return fill(S.renewal_agreed, { tenant, date: r?.meeting ? formatDateTime(r.meeting.startsAt) : '' });
    case 'renewed':
      return fill(S.renewed, { date: formatDate(r?.newEndDate ?? p.lease?.endDate ?? '') });
    case 'leaving':
      return r?.ownerStep
        ? fill(t.turnover.owner.steps2[r.ownerStep], { tenant })
        : fill(S.leaving, { tenant, date: p.lease ? formatDate(p.lease.endDate) : '' });
    case 'searching':
      return snap && snap.applicants > 0 ? fill(S.searching, { n: snap.applicants, m: snap.relevant }) : S.searchingEmpty;
    case 'viewings':
      return fill(S.viewings, { n: snap?.upcomingViewings ?? 0, date: snap?.nextAppointmentAt ? formatDateTime(snap.nextAppointmentAt) : '' });
    case 'vacant':
      return S.vacant;
    case 'renovating':
      return S.renovating;
  }
}
