import type { Severity, TicketCategory } from '../types';
import { toAgorot, type Agorot } from './money';

/**
 * Approving small maintenance spend automatically.
 *
 * The landlord this product is built for approves a ₪280 tap washer with the
 * same three taps as a ₪4,000 boiler replacement, and the small ones are most
 * of the volume. The delay is the real cost: a tenant waits two days for a
 * decision nobody was ever going to say no to.
 *
 * Two rules keep this from being a way to spend someone's money behind their
 * back:
 *
 *  1. **It is a ceiling and a monthly cap, together.** A per-ticket limit alone
 *     lets twenty small jobs empty an account.
 *  2. **Every automatic approval is recorded with the rule that produced it.**
 *     Same principle as the screening audit log: the owner must be able to see
 *     what was decided for them and why.
 */

/**
 * What a job of this kind typically costs, before anyone has quoted it.
 *
 * A guess, and treated as one — it decides only whether to *ask*, never what to
 * pay. Real money is the receipt, which the owner sees regardless.
 */
const BASELINE: Record<TicketCategory, number> = {
  leak: 450,
  plumbing: 380,
  electrical: 420,
  ac: 350,
  boiler: 520,
  appliance: 400,
  lock: 300,
  paint: 900,
  other: 400,
};

/** Urgency costs money: out-of-hours call-outs carry a premium. */
const SEVERITY_MULTIPLIER: Record<Severity, number> = {
  low: 0.85,
  medium: 1,
  urgent: 1.45,
};

export function estimateFor(category: TicketCategory, severity: Severity): Agorot {
  return toAgorot(Math.round(BASELINE[category] * SEVERITY_MULTIPLIER[severity]));
}

export interface BudgetPolicy {
  enabled: boolean;
  /** Nothing above this is ever approved automatically */
  perTicketCeilingAgorot: number;
  /** Total that may be approved automatically in a calendar month */
  monthlyCapAgorot: number;
  /** Categories in scope. Empty means none — opting in is explicit. */
  categories: TicketCategory[];
  /** Urgent work is excluded by default: it is the expensive kind */
  includeUrgent: boolean;
}

/**
 * Off, until the owner turns it on. A product that starts spending money on
 * your behalf because you did not read the settings page is not a product
 * anybody should trust with a portfolio.
 */
export const DEFAULT_BUDGET_POLICY: BudgetPolicy = {
  enabled: false,
  perTicketCeilingAgorot: toAgorot(500),
  monthlyCapAgorot: toAgorot(2000),
  categories: ['leak', 'plumbing', 'electrical', 'ac', 'lock'],
  includeUrgent: false,
};

export type BudgetDecision =
  | { approved: true; reason: string; estimateAgorot: number }
  | { approved: false; reason: string; estimateAgorot: number };

/**
 * Decide, and say why in words the owner can read back later.
 *
 * The reason is written for the person who will one day ask "why was this
 * approved without me", so it names the rule and the numbers, not a code.
 */
export function evaluateBudget(input: {
  policy: BudgetPolicy;
  category: TicketCategory;
  severity: Severity;
  /** Already approved automatically this calendar month */
  spentThisMonthAgorot: number;
}): BudgetDecision {
  const { policy, category, severity, spentThisMonthAgorot } = input;
  const estimateAgorot = estimateFor(category, severity);
  const no = (reason: string): BudgetDecision => ({ approved: false, reason, estimateAgorot });

  if (!policy.enabled) return no('אישור אוטומטי כבוי');
  if (!policy.categories.includes(category)) return no('הקטגוריה לא נכללת באישור אוטומטי');
  if (severity === 'urgent' && !policy.includeUrgent) return no('תקלות דחופות דורשות אישור');

  if (estimateAgorot > policy.perTicketCeilingAgorot) {
    return no(
      `ההערכה (${fmt(estimateAgorot)}) גבוהה מהתקרה לתקלה (${fmt(policy.perTicketCeilingAgorot)})`,
    );
  }

  /* The cap counts the estimate that is about to be added, not only what has
     already gone out — otherwise the last approval of the month always slips
     through above the line. */
  if (spentThisMonthAgorot + estimateAgorot > policy.monthlyCapAgorot) {
    return no(
      `התקרה החודשית (${fmt(policy.monthlyCapAgorot)}) כמעט מוצתה — אושרו כבר ${fmt(spentThisMonthAgorot)}`,
    );
  }

  return {
    approved: true,
    reason: `אושר אוטומטית: הערכה ${fmt(estimateAgorot)}, מתחת לתקרה של ${fmt(policy.perTicketCeilingAgorot)}`,
    estimateAgorot,
  };
}

/** Shekels, for a sentence rather than a table. */
function fmt(agorot: number): string {
  return `₪${Math.round(agorot / 100).toLocaleString('he-IL')}`;
}
