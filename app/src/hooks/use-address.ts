import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { getMapSource } from '@/lib/map-source';
import { reverseGeocode } from '@/lib/osm';
import type { LatLng } from '@/lib/types';

/**
 * Street address for a coordinate: the device reverse geocoder on Android/iOS (no extra API), Photon
 * on web when the map source is OpenStreetMap. Falls back to `fallback` when nothing is found.
 */
export function useAddress(point: LatLng | null, fallback: string) {
  const [found, setFound] = useState<{ key: string; text: string } | null>(null);
  const key = point ? `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}` : null;

  useEffect(() => {
    if (!point || !key) return;
    let cancelled = false;
    if (Platform.OS === 'web') {
      if (getMapSource() !== 'osm') return;
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
    // Re-run only when the coordinate (rounded) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return found && found.key === key ? found.text : fallback;
}
