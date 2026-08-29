import { type MessageThread } from '@miftach/shared';
import { hoursAgo, daysAgo } from './clock';

const OWNER = 'רן אלמוג';

export const threads: MessageThread[] = [
  {
    id: 'th01', subject: 'נזילה במטבח — מתי מגיע אינסטלטור?',
    counterparty_role: 'tenant', counterparty_id: 't11', counterparty_name: 'מיכל שטרן',
    property_id: 'p11', ticket_id: 'tk01', updated_at: hoursAgo(4),
    messages: [
      { id: 'm1', author_role: 'tenant', author_name: 'מיכל שטרן', body: 'פתחתי קריאה על הנזילה. זה באמת דחוף, הארון מתחיל להתנפח.', at: hoursAgo(5), read: true },
      { id: 'm2', author_role: 'tenant', author_name: 'מיכל שטרן', body: 'אני בבית עד 19:00 היום ואחר כך מחר מ־9.', at: hoursAgo(4), read: false },
    ],
  },
  {
    id: 'th02', subject: 'מזגן — טופל',
    counterparty_role: 'tenant', counterparty_id: 't09', counterparty_name: 'רותם אזולאי',
    property_id: 'p09', ticket_id: 'tk08', updated_at: hoursAgo(1),
    messages: [
      { id: 'm1', author_role: 'tenant', author_name: 'רותם אזולאי', body: 'המזגן לא מקרר בכלל ויש לנו תינוקת בבית.', at: daysAgo(1), read: true },
      { id: 'm2', author_role: 'owner', author_name: OWNER, body: 'שלחתי את קור־טק להיום ב־13:00.', at: hoursAgo(22), read: true },
      { id: 'm3', author_role: 'tenant', author_name: 'רותם אזולאי', body: 'תודה ענקית, הם היו כאן וזה עובד.', at: hoursAgo(1), read: false },
    ],
  },
  {
    id: 'th03', subject: 'סיום חוזה ופינוי',
    counterparty_role: 'tenant', counterparty_id: 't19', counterparty_name: 'ניר אשכנזי',
    property_id: 'p19', updated_at: daysAgo(2),
    messages: [
      { id: 'm1', author_role: 'owner', author_name: OWNER, body: 'היי ניר, רק מוודא — אתה מפנה בסוף החודש הבא כמו שסיכמנו?', at: daysAgo(3), read: true },
      { id: 'm2', author_role: 'tenant', author_name: 'ניר אשכנזי', body: 'כן, מצאתי דירה בהרצליה. אפנה עד ה־28.', at: daysAgo(2), read: true },
    ],
  },
  {
    id: 'th04', subject: 'שאלה על הדירה בלבנדה',
    counterparty_role: 'lead', counterparty_id: 's01', counterparty_name: 'טל אבירם',
    property_id: 'p02', lead_id: 'ld03', updated_at: daysAgo(1),
    messages: [
      { id: 'm1', author_role: 'lead', author_name: 'טל אבירם', body: 'שלום, שריינתי מקום בתור לדירה בלבנדה 14. אפשר לדעת אם המרפסת פונה לרחוב או לחצר?', at: daysAgo(2), read: true },
      { id: 'm2', author_role: 'owner', author_name: OWNER, body: 'שלום טל, לחצר פנימית — הרבה יותר שקט. יש צפייה ביום שני, מעוניין?', at: daysAgo(2), read: true },
      { id: 'm3', author_role: 'lead', author_name: 'טל אבירם', body: 'בהחלט. באיזו שעה נוח לך?', at: daysAgo(1), read: false },
    ],
  },
  {
    id: 'th05', subject: 'הצעה — שיינקין 33',
    counterparty_role: 'lead', counterparty_id: 's02', counterparty_name: 'מאיה הרוש',
    property_id: 'p12', lead_id: 'ld23', updated_at: daysAgo(4),
    messages: [
      { id: 'm1', author_role: 'owner', author_name: OWNER, body: 'מאיה, שלחתי לך טיוטת חוזה למייל. שכר דירה 5,400, חוזה לשנה עם אופציה.', at: daysAgo(5), read: true },
      { id: 'm2', author_role: 'lead', author_name: 'מאיה הרוש', body: 'קיבלתי, עוברת עם עורך דין ואחזור עד סוף השבוע.', at: daysAgo(4), read: true },
    ],
  },
  {
    id: 'th06', subject: 'תיאום סתימה — ז׳בוטינסקי',
    counterparty_role: 'vendor', counterparty_id: 'v01', counterparty_name: 'אבי כהן — אינסטלציה',
    property_id: 'p18', ticket_id: 'tk06', updated_at: hoursAgo(20),
    messages: [
      { id: 'm1', author_role: 'owner', author_name: OWNER, body: 'אבי, יש סתימה בז׳בוטינסקי 104 דירה 24. הדיירים פנויים מחר ב־11.', at: daysAgo(1), read: true },
      { id: 'm2', author_role: 'vendor', author_name: 'אבי כהן — אינסטלציה', body: 'רשום. אם צריך ביובית זה תוספת של 600, אעדכן לפני.', at: hoursAgo(20), read: true },
    ],
  },
  {
    id: 'th07', subject: 'קבלה על תיקון תאורה',
    counterparty_role: 'vendor', counterparty_id: 'v09', counterparty_name: 'ליאור חשמל ותאורה',
    property_id: 'p01', ticket_id: 'tk10', updated_at: daysAgo(2),
    messages: [
      { id: 'm1', author_role: 'owner', author_name: OWNER, body: 'ליאור, תעלה בבקשה קבלה על העבודה בווליניה 3 ואסגור את הקריאה.', at: daysAgo(2), read: true },
      { id: 'm2', author_role: 'vendor', author_name: 'ליאור חשמל ותאורה', body: 'שולח היום־מחר, סליחה על העיכוב.', at: daysAgo(2), read: true },
    ],
  },
  {
    id: 'th08', subject: 'חידוש חוזה — שבזי 26',
    counterparty_role: 'tenant', counterparty_id: 't06', counterparty_name: 'דנה קלמן',
    property_id: 'p06', updated_at: daysAgo(11),
    messages: [
      { id: 'm1', author_role: 'owner', author_name: OWNER, body: 'דנה, החוזה מסתיים בעוד תשעה חודשים. רוצה להאריך?', at: daysAgo(12), read: true },
      { id: 'm2', author_role: 'tenant', author_name: 'דנה קלמן', body: 'כן, אשמח להישאר. נדבר על התנאים קרוב יותר לתאריך?', at: daysAgo(11), read: true },
    ],
  },
  {
    id: 'th09', subject: 'ארנונה על דירה פנויה',
    counterparty_role: 'vendor', counterparty_id: 'v00', counterparty_name: 'עיריית תל אביב-יפו',
    property_id: 'p07', updated_at: daysAgo(15),
    messages: [
      { id: 'm1', author_role: 'vendor', author_name: 'עיריית תל אביב-יפו', body: 'הודעה על חיוב ארנונה לתקופה שבה הנכס אינו מאוכלס. ניתן להגיש בקשה לפטור לנכס ריק.', at: daysAgo(15), read: true },
    ],
  },
  {
    id: 'th10', subject: 'ממתין לתור — ז׳בוטינסקי 104',
    counterparty_role: 'lead', counterparty_id: 's07', counterparty_name: 'גיא סבן',
    property_id: 'p18', lead_id: 'ld27', updated_at: daysAgo(6),
    messages: [
      { id: 'm1', author_role: 'lead', author_name: 'גיא סבן', body: 'שלום, אני בתור לדירה בז׳בוטינסקי. יש כבר תאריך פינוי סופי?', at: daysAgo(7), read: true },
      { id: 'm2', author_role: 'owner', author_name: OWNER, body: 'החוזה מסתיים בעוד ארבעה חודשים. הדיירים עדיין לא החליטו אם מאריכים — ברגע שיש תשובה תעודכן.', at: daysAgo(6), read: true },
    ],
  },
];
