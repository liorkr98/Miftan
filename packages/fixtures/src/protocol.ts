import { type ProtocolRun } from '@miftan/shared';
import { daysAgo, photo } from './clock';

/* The checklist itself is domain, not seed data — it lives in @miftan/shared
   so the API can project a run without depending on the fixtures package.
   Re-exported here because callers have always found it at this path. */
export { protocolItems } from '@miftan/shared';

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
      { item_id: 'pi-elec', done: true, value: '48210', photos: [photo('miftan-pr01-elec', 700, 500)] },
      { item_id: 'pi-water', done: true, value: '312', photos: [photo('miftan-pr01-water', 700, 500)] },
      { item_id: 'pi-gas', done: true, value: '104', photos: [] },
      { item_id: 'pi-keys-door', done: true, value: '3', photos: [] },
      { item_id: 'pi-keys-mail', done: true, value: '1', photos: [] },
      { item_id: 'pi-keys-building', done: true, value: '1', photos: [] },
      { item_id: 'pi-keys-storage', done: false, photos: [], note: 'אין מחסן ליחידה' },
      { item_id: 'pi-cond-living', done: true, photos: [photo('miftan-pr01-liv1', 800, 600), photo('miftan-pr01-liv2', 800, 600)] },
      { item_id: 'pi-cond-kitchen', done: true, photos: [photo('miftan-pr01-kit', 800, 600)], note: 'שריטה בשיש ליד הכיור, תועדה' },
      { item_id: 'pi-cond-bath', done: true, photos: [photo('miftan-pr01-bath', 800, 600)] },
      { item_id: 'pi-cond-rooms', done: true, photos: [photo('miftan-pr01-room', 800, 600)] },
      { item_id: 'pi-cond-balcony', done: true, photos: [photo('miftan-pr01-bal', 800, 600)] },
      { item_id: 'pi-cond-damp', done: true, photos: [], note: 'ללא סימני רטיבות' },
      { item_id: 'pi-app-ac', done: true, photos: [photo('miftan-pr01-ac', 800, 600)] },
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
