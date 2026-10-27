import type { RefObject } from 'react';

import type { MapRef } from '@/components/map/map-view';
import type { LatLng } from '@/lib/types';

/** Street-level zoom used by the "my location" button. */
export const STREET_ZOOM = 17;

/** Center on a point and zoom to street level, keeping the current rotation (like Google Maps). */
export function centerOn(map: RefObject<MapRef | null>, p: LatLng | null) {
  if (!p) return;
  map.current?.animateCamera(
    { center: { latitude: p.latitude, longitude: p.longitude }, zoom: STREET_ZOOM },
    { duration: 500 },
  );
}
