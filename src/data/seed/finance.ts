import type { Expense, RentPayment } from '@/types';
import { leases } from './leases';
import { daysAgo, monthKey, addMonths, DEMO_TODAY, isoDate, photo } from './clock';

/* ── Expenses ──────────────────────────────────────────── */

export const expenses: Expense[] = [
  /* auto-created when a ticket closed with a receipt */
  { id: 'ex12', property_id: 'p11', kind: 'maintenance', category: 'ac', amount: 420, vendor_id: 'v03', vendor_name: 'קור־טק מיזוג אוויר', date: daysAgo(45).slice(0, 10), ticket_id: 'tk12', receipt_file: photo('miftach-rc12', 700, 900), document_type: 'tax_invoice' },
  { id: 'ex13', property_id: 'p15', kind: 'maintenance', category: 'plumbing', amount: 1250, vendor_id: 'v01', vendor_name: 'אבי כהן — אינסטלציה', date: daysAgo(36).slice(0, 10), ticket_id: 'tk13', receipt_file: photo('miftach-rc13', 700, 900), document_type: 'tax_invoice' },
  { id: 'ex14', property_id: 'p21', kind: 'maintenance', category: 'appliance', amount: 340, vendor_id: 'v07', vendor_name: 'איציק אבו — שיפוצניק', date: daysAgo(20).slice(0, 10), ticket_id: 'tk14', receipt_file: photo('miftach-rc14', 700, 900), document_type: 'receipt' },

  /* recorded manually */
  { id: 'ex01', property_id: 'p14', kind: 'improvement', category: 'other', amount: 38400, vendor_id: 'v05', vendor_name: 'ניר צביעה ושיפוצים', date: daysAgo(28).slice(0, 10), receipt_file: photo('miftach-rc01', 700, 900), document_type: 'tax_invoice', note: 'שיפוץ מטבח וחדר רחצה' },
  { id: 'ex02', property_id: 'p05', kind: 'maintenance', category: 'boiler', amount: 890, vendor_id: 'v01', vendor_name: 'אבי כהן — אינסטלציה', date: daysAgo(64).slice(0, 10), document_type: 'receipt' },
  { id: 'ex03', property_id: 'p08', kind: 'maintenance', category: 'electrical', amount: 620, vendor_id: 'v02', vendor_name: 'מוסא חשמל', date: daysAgo(72).slice(0, 10), document_type: 'tax_invoice' },
  { id: 'ex04', property_id: 'p11', kind: 'maintenance', category: 'paint', amount: 2400, vendor_id: 'v05', vendor_name: 'ניר צביעה ושיפוצים', date: daysAgo(88).slice(0, 10), document_type: 'tax_invoice' },
  { id: 'ex05', property_id: 'p01', kind: 'maintenance', category: 'lock', amount: 480, vendor_id: 'v04', vendor_name: 'שלמה מנעולים 24/7', date: daysAgo(103).slice(0, 10), document_type: 'receipt' },
  { id: 'ex06', property_id: 'p13', kind: 'maintenance', category: 'ac', amount: 1180, vendor_id: 'v03', vendor_name: 'קור־טק מיזוג אוויר', date: daysAgo(119).slice(0, 10), document_type: 'tax_invoice', note: 'החלפת מדחס' },
  { id: 'ex07', property_id: 'p06', kind: 'maintenance', category: 'other', amount: 750, vendor_id: 'v06', vendor_name: 'דרור הדברה', date: daysAgo(134).slice(0, 10), document_type: 'tax_invoice', note: 'הדברת נמלים ותיקנים' },
  { id: 'ex08', property_id: 'p18', kind: 'improvement', category: 'other', amount: 6200, vendor_id: 'v07', vendor_name: 'איציק אבו — שיפוצניק', date: daysAgo(147).slice(0, 10), document_type: 'tax_invoice', note: 'החלפת ארונות מטבח' },
  { id: 'ex09', property_id: 'p20', kind: 'maintenance', category: 'plumbing', amount: 530, vendor_id: 'v08', vendor_name: 'רם אינסטלציה ודודי שמש', date: daysAgo(162).slice(0, 10), document_type: 'receipt' },
  { id: 'ex10', property_id: 'p17', kind: 'maintenance', category: 'electrical', amount: 410, vendor_id: 'v09', vendor_name: 'ליאור חשמל ותאורה', date: daysAgo(178).slice(0, 10), document_type: 'receipt' },
  { id: 'ex11', property_id: 'p03', kind: 'maintenance', category: 'appliance', amount: 980, vendor_id: 'v07', vendor_name: 'איציק אבו — שיפוצניק', date: daysAgo(195).slice(0, 10), document_type: 'tax_invoice', note: 'החלפת מקרר' },

  /* fixed costs the owner carries on vacant units */
  { id: 'ex15', property_id: 'p07', kind: 'maintenance', category: 'arnona', amount: 760, date: daysAgo(15).slice(0, 10), document_type: 'none', note: 'ארנונה על דירה פנויה' },
  { id: 'ex16', property_id: 'p16', kind: 'maintenance', category: 'arnona', amount: 480, date: daysAgo(15).slice(0, 10), document_type: 'none', note: 'ארנונה על דירה פנויה' },
  { id: 'ex17', property_id: 'p22', kind: 'maintenance', category: 'vaad', amount: 140, date: daysAgo(12).slice(0, 10), document_type: 'none' },
  { id: 'ex18', property_id: 'p14', kind: 'maintenance', category: 'arnona', amount: 960, date: daysAgo(14).slice(0, 10), document_type: 'none', note: 'ארנונה בזמן שיפוץ' },
  { id: 'ex19', property_id: 'p05', kind: 'maintenance', category: 'insurance', amount: 2100, date: daysAgo(58).slice(0, 10), document_type: 'tax_invoice', note: 'ביטוח מבנה שנתי' },
  { id: 'ex20', property_id: 'p08', kind: 'maintenance', category: 'insurance', amount: 2400, date: daysAgo(58).slice(0, 10), document_type: 'tax_invoice', note: 'ביטוח מבנה שנתי' },
  { id: 'ex21', property_id: 'p02', kind: 'maintenance', category: 'legal', amount: 1500, date: daysAgo(210).slice(0, 10), document_type: 'tax_invoice', note: 'עריכת חוזה שכירות' },
  { id: 'ex22', property_id: 'p09', kind: 'maintenance', category: 'legal', amount: 1500, date: daysAgo(240).slice(0, 10), document_type: 'tax_invoice', note: 'עריכת חוזה שכירות' },
];

/* ── Rent roll ─────────────────────────────────────────── */

/** 12 months back through the current month, for every active lease.
 *  A few misses on purpose so "outstanding" is a real number. */
const LATE: Record<string, number[]> = {
  l04: [0],        // current month unpaid
  l12: [0],        // current month unpaid
  l15: [0, -1],    // two months behind
  l19: [-2],       // one historic miss, since settled
};

const PARTIAL: Record<string, number[]> = {
  l10: [0],        // paid part of this month
};

export const rentPayments: RentPayment[] = leases.flatMap((lease) => {
  const start = new Date(lease.start_date);
  const out: RentPayment[] = [];
  for (let offset = -11; offset <= 0; offset++) {
    const month = addMonths(DEMO_TODAY, offset);
    month.setDate(1);
    if (month < start) continue;
    const late = LATE[lease.id]?.includes(offset) ?? false;
    const partial = PARTIAL[lease.id]?.includes(offset) ?? false;
    const paid = late ? 0 : partial ? Math.round(lease.monthly_rent * 0.55) : lease.monthly_rent;
    const paidDate = addMonths(DEMO_TODAY, offset);
    paidDate.setDate(Math.min(3 + (offset % 3), 10));
    out.push({
      id: `rp-${lease.id}-${monthKey(offset)}`,
      property_id: lease.property_id,
      lease_id: lease.id,
      month: monthKey(offset),
      due: lease.monthly_rent,
      paid,
      paid_at: paid > 0 ? isoDate(paidDate) : undefined,
      method: lease.payment_method,
    });
  }
  return out;
});
