import type { ScreeningPreset } from '@/types';
import { DEFAULT_CRITERIA } from '@/lib/screening';
import { daysAgo } from './clock';

export const screeningPresets: ScreeningPreset[] = [
  {
    id: 'sp01',
    name: 'ברירת מחדל',
    criteria: DEFAULT_CRITERIA,
    created_at: daysAgo(180),
    is_active: true,
  },
  {
    id: 'sp02',
    name: 'דירות פרימיום — נווה צדק ופלורנטין',
    criteria: [
      { id: 'income_to_rent', enabled: true, weight: 3, value: 3.5 },
      { id: 'employment', enabled: true, weight: 2 },
      { id: 'guarantors', enabled: true, weight: 3 },
      { id: 'move_in_date', enabled: true, weight: 2 },
      { id: 'lease_length', enabled: true, weight: 3, value: 24 },
      { id: 'smoking', enabled: true, weight: 2 },
      { id: 'pets', enabled: true, weight: 1 },
      { id: 'occupancy', enabled: true, weight: 2 },
      { id: 'reference', enabled: true, weight: 2 },
    ],
    created_at: daysAgo(92),
    is_active: false,
  },
  {
    id: 'sp03',
    name: 'השכרה מהירה — דירה פנויה',
    criteria: [
      { id: 'income_to_rent', enabled: true, weight: 2, value: 2.5 },
      { id: 'employment', enabled: true, weight: 1 },
      { id: 'guarantors', enabled: true, weight: 1 },
      { id: 'move_in_date', enabled: true, weight: 3 },
      { id: 'lease_length', enabled: true, weight: 2, value: 12 },
      { id: 'smoking', enabled: false, weight: 1 },
      { id: 'pets', enabled: false, weight: 1 },
      { id: 'occupancy', enabled: true, weight: 2 },
      { id: 'reference', enabled: false, weight: 1 },
    ],
    created_at: daysAgo(45),
    is_active: false,
  },
];
