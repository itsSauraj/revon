/**
 * Map source setting: which stack draws the map and answers place search and routing.
 *
 * - google: Google Maps SDKs / JavaScript API, Places (New) and Routes. Needs the Google keys.
 * - osm: OpenStreetMap data: OpenFreeMap vector tiles drawn by MapLibre, Photon search and Valhalla
 *   routing (OSRM as fallback). No keys, works on phones without Google services, no traffic data.
 *
 * Everything that differs between the two lives behind `components/map/map-view.tsx`,
 * `lib/places.ts` and `lib/directions.ts`; rides, riders, alerts and tracking don't care.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

export type MapSource = 'google' | 'osm';

export const MAP_SOURCES: { id: MapSource; name: string; summary: string }[] = [
  {
    id: 'google',
    name: 'Google Maps',
    summary: 'Google map, Places search and Routes with live traffic. Needs the Google API keys.',
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    summary: 'Community map data with MapLibre, Photon search and Valhalla routing. No keys, no traffic layer; works without Google services.',
  },
];

/** What each source can draw; the layers sheet hides what the current source lacks. */
export type MapCapabilities = {
  satellite: boolean;
  terrain: boolean;
  traffic: boolean;
  buildings: boolean;
  bicycling: boolean;
};

export const MAP_CAPABILITIES: Record<MapSource, MapCapabilities> = {
  // Google's mobile SDKs have no bicycling layer; the JavaScript API does.
  google: { satellite: true, terrain: true, traffic: true, buildings: true, bicycling: Platform.OS === 'web' },
  // Satellite and terrain are raster overlays (Esri imagery, OpenTopoMap); bicycling is the
  // Waymarked Trails overlay. Nobody publishes free live traffic.
  osm: { satellite: true, terrain: true, traffic: false, buildings: true, bicycling: true },
};

export const hasGoogleKey = Boolean(Constants.expoConfig?.extra?.googleApiKey);

const KEY = 'revon.mapSource';
/** Google when the project has a key (the original setup); OpenStreetMap otherwise. */
const DEFAULT: MapSource = hasGoogleKey ? 'google' : 'osm';

let state: MapSource = DEFAULT;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (raw !== 'google' && raw !== 'osm') return;
    state = raw;
    listeners.forEach((l) => l());
  })
  .catch(() => {});

/** Current source, for code that runs outside React (routing and search facades). */
export function getMapSource(): MapSource {
  return state;
}

export function setMapSource(source: MapSource) {
  if (source === state) return;
  state = source;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, source).catch(() => {});
}

export function useMapSource(): MapSource {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function useMapCapabilities(): MapCapabilities {
  return MAP_CAPABILITIES[useMapSource()];
}
