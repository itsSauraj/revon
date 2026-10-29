import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { Fix } from './use-route-follow';

/**
 * The rider's live position from the device (expo-location; the browser's geolocation on web),
 * independent of which map is on screen. The map's own location dot can then be switched off, for
 * example while the ride view shows the navigation puck instead. On first launch the watch starts
 * once the permission dialog has been answered (the app goes inactive and comes back).
 */
export function useLiveFix(): Fix | null {
  const [fix, setFix] = useState<Fix | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let starting = false;
    let cancelled = false;
    const start = async () => {
      if (sub || starting) return;
      starting = true;
      try {
        // Screens request the permission themselves; this only resolves at once when it was granted.
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted || cancelled) return;
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 2 },
          (loc) => {
            setFix({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading ?? -1,
              speed: loc.coords.speed ?? -1,
            });
          },
        );
        if (cancelled) s.remove();
        else sub = s;
      } catch {
        // Location services unavailable; try again when the app next becomes active.
      } finally {
        starting = false;
      }
    };
    start();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
    });
    return () => {
      cancelled = true;
      appState.remove();
      sub?.remove();
    };
  }, []);

  return fix;
}
