import type { IconType } from 'react-icons';
import { LuCoffee, LuFlag, LuFuel, LuSiren, LuUtensils, LuWrench } from 'react-icons/lu';

import type { RiderStatus } from '@/lib/types';

type StatusMeta = { icon: IconType; label: string; tag: string };

/** How each non-riding status is shown: chip label, and the tag drawn on the map. */
export const STATUS_META: Partial<Record<RiderStatus, StatusMeta>> = {
  fuel: { icon: LuFuel, label: 'Fuel', tag: 'Fuel stop' },
  rest: { icon: LuCoffee, label: 'Rest', tag: 'Rest stop' },
  food: { icon: LuUtensils, label: 'Food', tag: 'Food stop' },
  mechanical: { icon: LuWrench, label: 'Mechanical', tag: 'Mechanical' },
  sos: { icon: LuSiren, label: 'SOS', tag: 'Needs help' },
  arrived: { icon: LuFlag, label: 'Arrived', tag: 'Arrived' },
};

/** Statuses a rider can set from the panel. */
export const STOP_STATUSES: RiderStatus[] = ['fuel', 'rest', 'food', 'mechanical'];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}
