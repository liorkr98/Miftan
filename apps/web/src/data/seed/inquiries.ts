import { type AvailabilityInquiry } from '@miftach/shared';
import { daysAgo, monthsOut } from './clock';

/**
 * The chain that makes an undecided apartment useful:
 * seeker asks the owner → owner asks the tenant → tenant answers → owner
 * updates the seeker. The seeker and the tenant never meet.
 */
export const inquiries: AvailabilityInquiry[] = [
  {
    id: 'iq01',
    property_id: 'p17',
    seeker_id: 's04',
    message:
      'שלום, אנחנו מחפשים 3 חדרים במרכז רמת גן לכניסה בסביבות פברואר. ראיתי שהדירה מושכרת אבל שהחוזה נגמר בערך אז — יש סיכוי שהיא תתפנה?',
    desired_move_in: monthsOut(5, 1),
    created_at: daysAgo(2),
    status: 'new',
  },
  {
    id: 'iq02',
    property_id: 'p01',
    seeker_id: 's13',
    message:
      'היי, הדירה בווליניה נראית בדיוק מה שחיפשנו. אפשר לדעת אם הדיירים הנוכחיים מתכוונים להישאר?',
    desired_move_in: monthsOut(9, 1),
    created_at: daysAgo(5),
    status: 'asked_tenant',
    asked_tenant_at: daysAgo(4),
  },
  {
    id: 'iq03',
    property_id: 'p20',
    seeker_id: 's09',
    message:
      'מחפשים דירת 3 חדרים בגבעתיים לקראת סוף השנה הבאה. אנחנו גמישים בתאריך, רק רוצים לדעת אם יש בכלל סיכוי.',
    desired_move_in: monthsOut(16, 1),
    created_at: daysAgo(9),
    status: 'answered',
    asked_tenant_at: daysAgo(8),
    tenant_answer: 'too_early',
    tenant_answer_note: 'תלוי אם נחתום על הבית בשוהם. נדע יותר בעוד כמה חודשים.',
    tenant_answered_at: daysAgo(6),
  },
  {
    id: 'iq04',
    property_id: 'p15',
    seeker_id: 's11',
    message: 'שלום, מתעניין בדירה בקריית שלום. מתי צפוי להתפנות?',
    desired_move_in: monthsOut(8, 1),
    created_at: daysAgo(16),
    status: 'replied',
    asked_tenant_at: daysAgo(15),
    tenant_answer: 'extend',
    tenant_answered_at: daysAgo(13),
    owner_reply:
      'שלום, בדקתי מול הדיירים — הם מתכוונים להאריך את החוזה, כך שהדירה כנראה לא תתפנה השנה. אעדכן אותך אם משהו ישתנה.',
    owner_replied_at: daysAgo(12),
  },
  {
    id: 'iq05',
    property_id: 'p11',
    seeker_id: 's01',
    message:
      'שלום, אני מחפש 3–4 חדרים בלב העיר. הדירה בנחלת בנימין מסומנת כמושכרת בלי תאריך — אפשר לברר אם היא מתפנה בשנה הקרובה?',
    desired_move_in: monthsOut(11, 1),
    created_at: daysAgo(1),
    status: 'new',
  },
];
