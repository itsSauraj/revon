import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type MapType = 'default' | 'satellite' | 'terrain';

export type MapLayers = {
  type: MapType;
  traffic: boolean;
  buildings: boolean;
  /** Web only: Google's mobile map SDKs have no bicycling layer. */
  bicycling: boolean;
};

const KEY = 'revon.mapLayers';
const DEFAULTS: MapLayers = { type: 'default', traffic: false, buildings: false, bicycling: false };

let state: MapLayers = DEFAULTS;
const listeners = new Set<() => void>();

// Restore the rider's last choice; shared by every map in the app.
AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    state = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<MapLayers>) };
    listeners.forEach((l) => l());
  })
  .catch(() => {});

export function setMapLayers(patch: Partial<MapLayers>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export function useMapLayers() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
