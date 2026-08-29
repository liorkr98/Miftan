import { type SeasonalTaskTemplate } from '@miftach/shared';

/**
 * Preventive maintenance, scheduled by month rather than by complaint.
 *
 * `avoided_cost` is the argument, not decoration: an owner approves a ₪350
 * AC service when they can see the ₪1,400 compressor it prevents. Every
 * template carries both numbers so the UI never has to argue in the abstract.
 *
 * `failure_rate` keeps that argument honest — not every skipped task ends in
 * the failure, so the headline number is an expected value, not a gross one.
 */
export const seasonalTemplates: SeasonalTaskTemplate[] = [
  {
    id: 'st-ac-spring',
    due_month: 4,
    season: 'spring',
    category: 'ac',
    title: 'ניקוי וטיפול למזגן לפני הקיץ',
    why: 'מזגן סתום עובד קשה יותר, צורך יותר חשמל, ונשרף בדיוק בגל החום הראשון — כשאין תורים פנויים ואין סבלנות אצל הדייר.',
    requires_amenity: 'ac',
    typical_cost: 350,
    failure_rate: 0.35,
    avoided_cost: 1400,
    trade: 'ac_tech',
  },
  {
    id: 'st-boiler-spring',
    due_month: 5,
    season: 'spring',
    category: 'boiler',
    title: 'בדיקת דוד שמש וניקוי קולטים',
    why: 'קולטים מאובקים מורידים את התפוקה עשרות אחוזים, והדייר עובר לגיבוי החשמלי בלי לשים לב — עד שמגיע חשבון החשמל.',
    typical_cost: 280,
    failure_rate: 0.3,
    avoided_cost: 1200,
    trade: 'plumber',
  },
  {
    id: 'st-pest-summer',
    due_month: 6,
    season: 'summer',
    category: 'other',
    title: 'הדברה מונעת לפני העונה',
    why: 'טיפול מונע אחד בקיץ זול מקריאת חירום אחרי שהדייר כבר ראה ג׳וקים במטבח — ומזול בהרבה מדייר שמחליט לא להאריך.',
    typical_cost: 450,
    failure_rate: 0.5,
    avoided_cost: 900,
    trade: 'pest',
  },
  {
    id: 'st-seal-autumn',
    due_month: 10,
    season: 'autumn',
    category: 'leak',
    title: 'בדיקת איטום ונזילות לפני החורף',
    why: 'הגשם הראשון מגלה כל סדק. נזק רטיבות מתגלה מאוחר, מתפשט לשכנים, וגורר גם תיקון וגם ועד בית.',
    typical_cost: 450,
    failure_rate: 0.25,
    avoided_cost: 4500,
    trade: 'handyman',
  },
  {
    id: 'st-gutters-autumn',
    due_month: 10,
    season: 'autumn',
    category: 'gutters',
    title: 'ניקוי מרזבים ותעלות ניקוז',
    why: 'מרזב סתום מציף מרפסת ומחלחל לקירות. חצי שעת עבודה בסתיו מול תיקון קירות באביב.',
    requires_amenity: 'balcony',
    typical_cost: 220,
    failure_rate: 0.3,
    avoided_cost: 3000,
    trade: 'handyman',
  },
  {
    id: 'st-elec-winter',
    due_month: 11,
    season: 'winter',
    category: 'electrical',
    title: 'בדיקת לוח חשמל ופחת לפני עומס החורף',
    why: 'החורף מכניס מפזרי חום ומייבשי כביסה לאותם שקעים. פחת תקין הוא ההבדל בין קצר לבין דוח מכבי אש.',
    typical_cost: 320,
    failure_rate: 0.15,
    avoided_cost: 1800,
    trade: 'electrician',
  },
  {
    id: 'st-gas-winter',
    due_month: 12,
    season: 'winter',
    category: 'gas',
    title: 'בדיקת תקינות גז וצנרת',
    why: 'הבדיקה הכי זולה ברשימה מול הסיכון הכי גדול בה. גם חברות הביטוח שואלות עליה.',
    typical_cost: 180,
    failure_rate: 0.03,
    avoided_cost: 8000,
    trade: 'plumber',
  },
  {
    id: 'st-inspect-winter',
    due_month: 1,
    season: 'winter',
    category: 'inspection',
    title: 'סבב בדיקה בדירות מאוכלסות',
    why: 'ביקור מתואם אחת לשנה מגלה נזילות קטנות ובלאי לפני שהם הופכים לקריאות דחופות — ומאותת לדייר שמישהו מטפל בדירה.',
    typical_cost: 0,
    failure_rate: 0.4,
    avoided_cost: 2200,
    trade: 'handyman',
  },
];
