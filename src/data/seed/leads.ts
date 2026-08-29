import type { Lead, LeadStage } from '@/types';
import { seekers } from './people';
import { daysAgo, monthsOut } from './clock';

type Row = [
  id: string,
  property_id: string,
  seeker_id: string,
  stage: LeadStage,
  ageDays: number,
  queue_position: number,
  moveInMonths: number,
];

/** Screening flags are computed at boot from the active preset, so the
 *  audit log and the ranking always agree with what the owner configured. */
const rows: Row[] = [
  // p02 · לבנדה 14 — מתפנה בעוד חודש, הכי מבוקשת
  ['ld01', 'p02', 's05', 'offer', 34, 1, 2],
  ['ld02', 'p02', 's13', 'viewed', 28, 2, 2],
  ['ld03', 'p02', 's01', 'viewing_scheduled', 21, 3, 2],
  ['ld04', 'p02', 's08', 'screening', 12, 4, 2],
  ['ld05', 'p02', 's16', 'new', 5, 5, 1],
  ['ld06', 'p02', 's20', 'new', 2, 6, 3],

  // p09 · ביאליק 22 — מתפנה בעוד חודש
  ['ld07', 'p09', 's17', 'offer', 41, 1, 2],
  ['ld08', 'p09', 's01', 'viewed', 33, 2, 2],
  ['ld09', 'p09', 's10', 'screening', 19, 3, 2],
  ['ld10', 'p09', 's24', 'new', 8, 4, 3],
  ['ld11', 'p09', 's06', 'rejected', 26, 5, 2],

  // p19 · אבא הלל סילבר 18 — מתפנה בעוד חודשיים
  ['ld12', 'p19', 's19', 'viewed', 24, 1, 3],
  ['ld13', 'p19', 's23', 'viewing_scheduled', 16, 2, 3],
  ['ld14', 'p19', 's11', 'screening', 10, 3, 2],
  ['ld15', 'p19', 's14', 'new', 3, 4, 4],

  // p07 · אמזלג 9 — פנויה עכשיו
  ['ld16', 'p07', 's21', 'signed', 47, 1, 0],
  ['ld17', 'p07', 's09', 'viewed', 22, 2, 0],
  ['ld18', 'p07', 's03', 'rejected', 30, 3, 1],

  // p16 · קיבוץ גלויות 71 — פנויה עכשיו
  ['ld19', 'p16', 's15', 'viewing_scheduled', 9, 1, 0],
  ['ld20', 'p16', 's25', 'new', 4, 2, 1],

  // p22 · רוטשילד 30, בת ים — פנויה עכשיו
  ['ld21', 'p22', 's22', 'viewed', 17, 1, 0],
  ['ld22', 'p22', 's12', 'screening', 7, 2, 1],

  // p12 · שיינקין 33 — מאוכלסת, מתפנה בעוד חודשיים
  ['ld23', 'p12', 's02', 'offer', 38, 1, 3],
  ['ld24', 'p12', 's18', 'screening', 15, 2, 3],
  ['ld25', 'p12', 's04', 'new', 6, 3, 2],

  // p18 · ז׳בוטינסקי 104 — מאוכלסת, מתפנה בעוד 4 חודשים
  ['ld26', 'p18', 's01', 'new', 11, 1, 5],
  ['ld27', 'p18', 's07', 'screening', 20, 2, 4],
  ['ld28', 'p18', 's18', 'rejected', 29, 3, 4],

  // p03 · הרצל 88 — מאוכלסת, מתפנה בעוד 5 חודשים
  ['ld29', 'p03', 's02', 'viewed', 13, 1, 6],
  ['ld30', 'p03', 's10', 'signed', 52, 2, 5],
];

/** ld26 is a watch, not a formal application — the seeker is only tracking it. */
const WATCH_ONLY = new Set(['ld26']);

export const leads: Lead[] = rows.map(
  ([id, property_id, seeker_id, stage, ageDays, queue_position, moveInMonths]) => {
    const seeker = seekers.find((s) => s.id === seeker_id);
    if (!seeker) throw new Error(`seed: unknown seeker ${seeker_id}`);
    return {
      id,
      property_id,
      seeker_id,
      stage,
      created_at: daysAgo(ageDays),
      desired_move_in: monthsOut(moveInMonths, 1),
      queue_position,
      screening: seeker.profile,
      screening_flags: [],
      watch_only: WATCH_ONLY.has(id) || undefined,
    };
  },
);
