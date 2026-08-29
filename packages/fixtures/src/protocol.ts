import { type ProtocolItem, type ProtocolRun } from '@miftach/shared';
import { daysAgo, photo } from './clock';

/**
 * פרוטוקול כניסה / יציאה.
 *
 * The item list is identical for move-in and move-out on purpose: the whole
 * value is the comparison between the two. A move-out dispute is settled by
 * putting the two runs side by side, so they have to be the same shape.
 */
export const protocolItems: ProtocolItem[] = [
  /* מונים */
  { id: 'pi-elec', section: 'meters', label: 'קריאת מונה חשמל', input: 'number', unit: 'קוט״ש', required: true, wants_photo: true },
  { id: 'pi-water', section: 'meters', label: 'קריאת מונה מים', input: 'number', unit: 'מ״ק', required: true, wants_photo: true },
  { id: 'pi-gas', section: 'meters', label: 'קריאת מונה גז', input: 'number', unit: 'מ״ק', required: false, wants_photo: true },

  /* מפתחות */
  { id: 'pi-keys-door', section: 'keys', label: 'מפתחות דלת כניסה', input: 'number', unit: 'יח׳', required: true },
  { id: 'pi-keys-mail', section: 'keys', label: 'מפתח תיבת דואר', input: 'number', unit: 'יח׳', required: true },
  { id: 'pi-keys-building', section: 'keys', label: 'שלט/מפתח שער הבניין', input: 'number', unit: 'יח׳', required: false },
  { id: 'pi-keys-storage', section: 'keys', label: 'מפתח מחסן או חניה', input: 'number', unit: 'יח׳', required: false },

  /* מצב הדירה */
  { id: 'pi-cond-living', section: 'condition', label: 'סלון — קירות, רצפה, חלונות', required: true, wants_photo: true },
  { id: 'pi-cond-kitchen', section: 'condition', label: 'מטבח — ארונות, שיש, כיור', required: true, wants_photo: true },
  { id: 'pi-cond-bath', section: 'condition', label: 'חדר רחצה ושירותים', required: true, wants_photo: true },
  { id: 'pi-cond-rooms', section: 'condition', label: 'חדרי שינה', required: true, wants_photo: true },
  { id: 'pi-cond-balcony', section: 'condition', label: 'מרפסת ותריסים', required: false, wants_photo: true },
  { id: 'pi-cond-damp', section: 'condition', label: 'סימני רטיבות או עובש', required: true, wants_photo: true },

  /* מכשירי חשמל */
  { id: 'pi-app-ac', section: 'appliances', label: 'מזגנים — פועלים ומנוקים', required: true, wants_photo: true },
  { id: 'pi-app-boiler', section: 'appliances', label: 'דוד שמש / חשמלי', required: true },
  { id: 'pi-app-oven', section: 'appliances', label: 'תנור וכיריים', required: false, wants_photo: true },
  { id: 'pi-app-fridge', section: 'appliances', label: 'מקרר', required: false },
  { id: 'pi-app-washer', section: 'appliances', label: 'מכונת כביסה', required: false },

  /* העברות ורישום */
  { id: 'pi-adm-arnona', section: 'admin', label: 'העברת ארנונה בעירייה', required: true },
  { id: 'pi-adm-elec', section: 'admin', label: 'העברת חשבון חשמל', required: true },
  { id: 'pi-adm-water', section: 'admin', label: 'העברת חשבון מים', required: true },
  { id: 'pi-adm-vaad', section: 'admin', label: 'עדכון ועד הבית', required: false },
  { id: 'pi-adm-deposit', section: 'admin', label: 'פיקדון / שטר חוב הופקד', required: true },
  { id: 'pi-adm-insurance', section: 'admin', label: 'אישור ביטוח תכולה מהדייר', required: false },
];

/** One completed move-in run so the surface isn't empty on first look. */
export const protocolRuns: ProtocolRun[] = [
  {
    id: 'pr01',
    property_id: 'p02',
    lease_id: 'l02',
    tenant_id: 't02',
    kind: 'move_in',
    started_at: daysAgo(700),
    completed_at: daysAgo(699),
    signed: true,
    entries: [
      { item_id: 'pi-elec', done: true, value: '48210', photos: [photo('miftach-pr01-elec', 700, 500)] },
      { item_id: 'pi-water', done: true, value: '312', photos: [photo('miftach-pr01-water', 700, 500)] },
      { item_id: 'pi-gas', done: true, value: '104', photos: [] },
      { item_id: 'pi-keys-door', done: true, value: '3', photos: [] },
      { item_id: 'pi-keys-mail', done: true, value: '1', photos: [] },
      { item_id: 'pi-keys-building', done: true, value: '1', photos: [] },
      { item_id: 'pi-keys-storage', done: false, photos: [], note: 'אין מחסן ליחידה' },
      { item_id: 'pi-cond-living', done: true, photos: [photo('miftach-pr01-liv1', 800, 600), photo('miftach-pr01-liv2', 800, 600)] },
      { item_id: 'pi-cond-kitchen', done: true, photos: [photo('miftach-pr01-kit', 800, 600)], note: 'שריטה בשיש ליד הכיור, תועדה' },
      { item_id: 'pi-cond-bath', done: true, photos: [photo('miftach-pr01-bath', 800, 600)] },
      { item_id: 'pi-cond-rooms', done: true, photos: [photo('miftach-pr01-room', 800, 600)] },
      { item_id: 'pi-cond-balcony', done: true, photos: [photo('miftach-pr01-bal', 800, 600)] },
      { item_id: 'pi-cond-damp', done: true, photos: [], note: 'ללא סימני רטיבות' },
      { item_id: 'pi-app-ac', done: true, photos: [photo('miftach-pr01-ac', 800, 600)] },
      { item_id: 'pi-app-boiler', done: true, photos: [] },
      { item_id: 'pi-app-oven', done: true, photos: [] },
      { item_id: 'pi-app-fridge', done: false, photos: [], note: 'הדירה נמסרת ללא מקרר' },
      { item_id: 'pi-app-washer', done: false, photos: [], note: 'הדירה נמסרת ללא מכונת כביסה' },
      { item_id: 'pi-adm-arnona', done: true, photos: [] },
      { item_id: 'pi-adm-elec', done: true, photos: [] },
      { item_id: 'pi-adm-water', done: true, photos: [] },
      { item_id: 'pi-adm-vaad', done: true, photos: [] },
      { item_id: 'pi-adm-deposit', done: true, photos: [], note: 'צ׳קים דחויים + שטר חוב עם שני ערבים' },
      { item_id: 'pi-adm-insurance', done: false, photos: [] },
    ],
  },
];
