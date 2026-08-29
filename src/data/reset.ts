import { owner, tenants, seekers } from './seed/people';
import { properties } from './seed/properties';
import { leases } from './seed/leases';
import { tickets } from './seed/tickets';
import { vendors } from './seed/vendors';
import { leads } from './seed/leads';
import { expenses, rentPayments } from './seed/finance';
import { threads } from './seed/messages';
import { screeningPresets } from './seed/screening';
import { inquiries } from './seed/inquiries';
import { protocolItems, protocolRuns } from './seed/protocol';
import { seasonalTemplates } from './seed/seasonal';
import { affiliateOffers, revenueStreams } from './seed/revenue';
import type { AuditEntry } from '@/types';
import { daysAgo } from './seed/clock';

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
