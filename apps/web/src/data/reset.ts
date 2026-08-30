import {
  owner, tenants, seekers, properties, leases, tickets, vendors, leads,
  expenses, rentPayments, threads, screeningPresets, inquiries,
  protocolItems, protocolRuns, seasonalTemplates, affiliateOffers,
  revenueStreams, daysAgo,
} from '@miftan/fixtures';
import { type AuditEntry } from '@miftan/shared';

/**
 * Every boot and every resetDemo() call goes through here. Seed modules are
 * treated as immutable, so this deep-clones before handing state to the store —
 * otherwise a reset would return already-mutated arrays.
 */
export function buildSeed() {
  const clone = <T>(x: T): T => structuredClone(x);

  const seedAudit: AuditEntry[] = [
    {
      id: 'au-seed-1',
      at: daysAgo(3),
      lead_id: 'ld05',
      lead_name: 'נדב אוחיון',
      property_id: 'p02',
      preset_name: 'ברירת מחדל',
      action: 'ranked',
      detail: 'דורג נמוך: יחס הכנסה מתחת לסף, ללא ערבים',
      flags: [],
    },
    {
      id: 'au-seed-2',
      at: daysAgo(9),
      lead_id: 'ld11',
      lead_name: 'נטע אלבז',
      property_id: 'p09',
      preset_name: 'ברירת מחדל',
      action: 'stage_changed',
      detail: 'סינון ← נדחה',
      flags: [],
    },
    {
      id: 'au-seed-3',
      at: daysAgo(21),
      lead_id: 'ld16',
      lead_name: 'עומרי ברזילי',
      property_id: 'p07',
      preset_name: 'ברירת מחדל',
      action: 'stage_changed',
      detail: 'הצעה ← חוזה נחתם',
      flags: [],
    },
  ];

  return {
    owner: clone(owner),
    properties: clone(properties),
    leases: clone(leases),
    tenants: clone(tenants),
    seekers: clone(seekers),
    tickets: clone(tickets),
    vendors: clone(vendors),
    leads: clone(leads),
    expenses: clone(expenses),
    rentPayments: clone(rentPayments),
    threads: clone(threads),
    screeningPresets: clone(screeningPresets),
    auditLog: seedAudit,
    inquiries: clone(inquiries),
    protocolItems: clone(protocolItems),
    protocolRuns: clone(protocolRuns),
    seasonalTemplates: clone(seasonalTemplates),
    seasonalTasks: [],
    revenueStreams: clone(revenueStreams),
    affiliateOffers: clone(affiliateOffers),
    offerRequests: [] as string[],
  };
}
