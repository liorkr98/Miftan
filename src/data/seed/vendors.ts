import type { Vendor } from '@/types';

export const vendors: Vendor[] = [
  {
    id: 'v01', name: 'אבי כהן — אינסטלציה', trade: 'plumber', phone: '0546612380',
    areas: ['תל אביב-יפו', 'גבעתיים'], rating: 4.8, jobs_done: 34,
    avg_response_hours: 3, callout_fee: 280, is_network_partner: true,
    note: 'זמין גם בסופ״ש, מגיע עם ציוד לפתיחת סתימות',
  },
  {
    id: 'v02', name: 'מוסא חשמל', trade: 'electrician', phone: '0523347119',
    areas: ['תל אביב-יפו', 'רמת גן', 'בת ים'], rating: 4.6, jobs_done: 21,
    avg_response_hours: 5, callout_fee: 320, is_network_partner: false,
    note: 'חשמלאי מוסמך, עובד גם מול ועדי בתים',
  },
  {
    id: 'v03', name: 'קור־טק מיזוג אוויר', trade: 'ac_tech', phone: '0508873204',
    areas: ['תל אביב-יפו', 'רמת גן', 'גבעתיים'], rating: 4.9, jobs_done: 41,
    avg_response_hours: 2, callout_fee: 350, is_network_partner: true,
    note: 'שירות מזגנים כולל ניקוי וגז. תור מהיר בגלי חום.',
  },
  {
    id: 'v04', name: 'שלמה מנעולים 24/7', trade: 'locksmith', phone: '0585529940',
    areas: ['תל אביב-יפו', 'בת ים'], rating: 4.4, jobs_done: 12,
    avg_response_hours: 1, callout_fee: 400, is_network_partner: false,
  },
  {
    id: 'v05', name: 'ניר צביעה ושיפוצים', trade: 'painter', phone: '0542273865',
    areas: ['תל אביב-יפו', 'גבעתיים', 'רמת גן'], rating: 4.7, jobs_done: 18,
    avg_response_hours: 24, callout_fee: 0, is_network_partner: false,
    note: 'הצעת מחיר לפי מ״ר, ללא דמי קריאה',
  },
  {
    id: 'v06', name: 'דרור הדברה', trade: 'pest', phone: '0503392276',
    areas: ['תל אביב-יפו', 'רמת גן', 'גבעתיים', 'בת ים'], rating: 4.5, jobs_done: 9,
    avg_response_hours: 8, callout_fee: 450, is_network_partner: true,
    note: 'רישיון משרד להגנת הסביבה, טיפול ידידותי לחיות מחמד',
  },
  {
    id: 'v07', name: 'איציק אבו — שיפוצניק', trade: 'handyman', phone: '0527764802',
    areas: ['תל אביב-יפו'], rating: 4.3, jobs_done: 27,
    avg_response_hours: 12, callout_fee: 200, is_network_partner: false,
    note: 'עבודות קטנות, תיקוני דלתות וארונות',
  },
  {
    id: 'v08', name: 'רם אינסטלציה ודודי שמש', trade: 'plumber', phone: '0546658817',
    areas: ['רמת גן', 'גבעתיים'], rating: 4.2, jobs_done: 7,
    avg_response_hours: 6, callout_fee: 260, is_network_partner: false,
  },
  {
    id: 'v09', name: 'ליאור חשמל ותאורה', trade: 'electrician', phone: '0521108843',
    areas: ['תל אביב-יפו', 'גבעתיים'], rating: 4.8, jobs_done: 15,
    avg_response_hours: 4, callout_fee: 300, is_network_partner: false,
  },
];
