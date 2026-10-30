import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { type MapSource, useMapSource } from '@/lib/map-source';
import { reverseGeocode } from '@/lib/osm';
import type { LatLng } from '@/lib/types';

/**
 * Street address for a coordinate. OpenStreetMap source: Photon on every platform, so no
 * Google-backed geocoder feeds that map. Google source: the device geocoder on Android/iOS (web has
 * none). Falls back to `fallback` when nothing is found.
 */
export function useAddress(point: LatLng | null, fallback: string, source?: MapSource) {
  const setting = useMapSource();
  const src = source ?? setting;
  const [found, setFound] = useState<{ key: string; text: string } | null>(null);
  const key = point ? `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}` : null;

  useEffect(() => {
    if (!point || !key) return;
    let cancelled = false;
    if (src === 'osm' || Platform.OS === 'web') {
      if (src !== 'osm') return;
      reverseGeocode(point)
        .then((line) => {
          if (!cancelled && line) setFound({ key, text: line });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }
    Location.reverseGeocodeAsync(point)
      .then(([a]) => {
        if (cancelled || !a) return;
        const line = [a.name && a.name !== a.street ? a.name : null, a.street, a.city ?? a.subregion]
          .filter(Boolean)
          .join(', ');
        if (line) setFound({ key, text: line });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Re-run only when the coordinate (rounded) or the source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, src]);

  return found && found.key === key ? found.text : fallback;
}
