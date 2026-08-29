import type {
  Lead,
  Property,
  ScreeningCriterion,
  ScreeningCriterionId,
  ScreeningFlag,
} from '@/types';
import { t } from '@/i18n/he';
import { daysUntil } from './format';
import { parseISO } from 'date-fns';

/**
 * Soft screening.
 *
 * Two rules make this legally defensible and are enforced by construction:
 *  1. Every criterion is objective and apartment-related. Protected
 *     characteristics are not representable in ScreeningProfile, so no
 *     preset can be built on them.
 *  2. A failed criterion never removes a lead. It lowers the rank and
 *     attaches a visible reason. Owners always see the whole list.
 */

export const DEFAULT_CRITERIA: ScreeningCriterion[] = [
  { id: 'income_to_rent', enabled: true, weight: 3, value: 3 },
  { id: 'employment', enabled: true, weight: 2 },
  { id: 'guarantors', enabled: true, weight: 2 },
  { id: 'move_in_date', enabled: true, weight: 3 },
  { id: 'lease_length', enabled: true, weight: 1, value: 12 },
  { id: 'smoking', enabled: false, weight: 1 },
  { id: 'pets', enabled: true, weight: 1 },
  { id: 'occupancy', enabled: true, weight: 2 },
  { id: 'reference', enabled: false, weight: 1 },
];

/** These are the ONLY criteria the system can express. Adding a protected
 *  characteristic here would require changing the type, which is the point. */
export const ALL_CRITERION_IDS: ScreeningCriterionId[] = DEFAULT_CRITERIA.map((c) => c.id);

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

const n = t.screening.flagNote;

function employmentLabel(key: string): string {
  const map = t.seeker.profile.employmentOptions as Record<string, string>;
  return map[key] ?? key;
}

/** Permitted occupancy: a rough, apartment-based heuristic — rooms + 1. */
export function permittedOccupancy(property: Property): number {
  return Math.floor(property.rooms) + 1;
}

export function evaluateLead(
  lead: Lead,
  property: Property,
  criteria: ScreeningCriterion[],
): ScreeningFlag[] {
  const s = lead.screening;
  const active = criteria.filter((c) => c.enabled);
  const flags: ScreeningFlag[] = [];

  for (const c of active) {
    switch (c.id) {
      case 'income_to_rent': {
        const threshold = Number(c.value ?? 3);
        const passed = s.income_to_rent_ratio >= threshold;
        flags.push({
          criterion: c.id,
          passed,
          note: fill(passed ? n.income_pass : n.income_fail, {
            ratio: s.income_to_rent_ratio.toFixed(1),
            threshold,
          }),
        });
        break;
      }
      case 'employment': {
        const passed = ['salaried', 'self_employed', 'retired'].includes(s.employment);
        flags.push({
          criterion: c.id,
          passed,
          note: fill(passed ? n.employment_pass : n.employment_fail, {
            employment: employmentLabel(s.employment),
          }),
        });
        break;
      }
      case 'guarantors': {
        flags.push({
          criterion: c.id,
          passed: s.has_guarantors,
          note: s.has_guarantors ? n.guarantors_pass : n.guarantors_fail,
        });
        break;
      }
      case 'move_in_date': {
        const target = property.available_from;
        if (!target) {
          flags.push({ criterion: c.id, passed: true, note: n.move_in_pass });
          break;
        }
        const gap = Math.abs(daysUntil(lead.desired_move_in, parseISO(target)));
        const passed = gap <= 45;
        flags.push({
          criterion: c.id,
          passed,
          note: fill(passed ? n.move_in_pass : n.move_in_fail, { gap }),
        });
        break;
      }
      case 'lease_length': {
        const threshold = Number(c.value ?? 12);
        const passed = s.lease_length_months >= threshold;
        flags.push({
          criterion: c.id,
          passed,
          note: fill(passed ? n.lease_length_pass : n.lease_length_fail, {
            months: s.lease_length_months,
            threshold,
          }),
        });
        break;
      }
      case 'smoking': {
        flags.push({
          criterion: c.id,
          passed: !s.smoker,
          note: s.smoker ? n.smoking_fail : n.smoking_pass,
        });
        break;
      }
      case 'pets': {
        const allowed = property.amenities.includes('pets_allowed');
        const passed = !s.pets || allowed;
        flags.push({
          criterion: c.id,
          passed,
          note: !s.pets ? n.pets_pass : allowed ? n.pets_pass_allowed : n.pets_fail,
        });
        break;
      }
      case 'occupancy': {
        const cap = permittedOccupancy(property);
        const passed = s.occupants <= cap;
        flags.push({
          criterion: c.id,
          passed,
          note: fill(passed ? n.occupancy_pass : n.occupancy_fail, {
            occupants: s.occupants,
            rooms: property.rooms,
          }),
        });
        break;
      }
      case 'reference': {
        flags.push({
          criterion: c.id,
          passed: s.prior_landlord_reference,
          note: s.prior_landlord_reference ? n.reference_pass : n.reference_fail,
        });
        break;
      }
    }
  }

  return flags;
}

/** 0–100. Weighted share of criteria met. Used for ranking only. */
export function leadScore(flags: ScreeningFlag[], criteria: ScreeningCriterion[]): number {
  const byId = new Map(criteria.map((c) => [c.id, c]));
  let total = 0;
  let earned = 0;
  for (const f of flags) {
    const w = byId.get(f.criterion)?.weight ?? 1;
    total += w;
    if (f.passed) earned += w;
  }
  if (total === 0) return 0;
  return Math.round((earned / total) * 100);
}

/** Leads are sorted, never filtered. Ties break on how long they've waited. */
export function rankLeads<T extends { score: number; created_at: string }>(leads: T[]): T[] {
  return [...leads].sort(
    (a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at),
  );
}
