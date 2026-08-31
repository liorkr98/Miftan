import type { ProtocolItem } from '../types';

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
