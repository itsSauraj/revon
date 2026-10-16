import { type RefObject, useState } from 'react';

import type { MapRef } from '@/components/map/map-view';

/**
 * Tracks the map's rotation (degrees clockwise from north). Pass `onRegionChangeComplete` to the
 * MapView; read `heading` to orient a compass.
 */
export function useMapHeading(map: RefObject<MapRef | null>) {
  const [heading, setHeading] = useState(0);
  return {
    heading,
    onRegionChangeComplete: () => {
      map.current
        ?.getCamera()
        .then((c) => setHeading(c.heading ?? 0))
        .catch(() => {});
    },
    /** Rotate the map back to north-up (and flatten the tilt). */
    resetNorth: () => {
      map.current?.animateCamera({ heading: 0, pitch: 0 }, { duration: 400 });
      setHeading(0);
    },
  };
}
