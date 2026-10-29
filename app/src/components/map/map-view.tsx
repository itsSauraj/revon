/**
 * The app's map. Picks a backend for the rider's map source setting (Settings → Map):
 *
 * - google: react-native-maps on Android/iOS, Google Maps JavaScript API on web (google-map.tsx)
 * - osm: MapLibre Native on Android/iOS, MapLibre GL JS on web (osm-map.tsx)
 *
 * Screens import MapView, Marker and Polyline from here and the imperative MapRef; the contract is
 * in types.ts. Changing the source remounts the map with the other backend; everything else (rides,
 * riders, routes, alerts) is unaware of it.
 */
import { createContext, useContext } from 'react';

import { type MapSource, useMapSource } from '@/lib/map-source';

import * as Google from './google-map';
import * as Osm from './osm-map';
import type { MapViewProps, MarkerProps, PolylineProps } from './types';

/** The source the enclosing MapView draws with, so its markers and lines use the same backend. */
const SourceContext = createContext<MapSource | null>(null);

function useBackend(explicit?: MapSource) {
  const setting = useMapSource();
  const enclosing = useContext(SourceContext);
  const source = explicit ?? enclosing ?? setting;
  return { source, Backend: source === 'osm' ? Osm : Google };
}

export type { Camera, EdgePadding, MapRef, MapViewProps, MarkerProps, PolylineProps, Region } from './types';

export function MapView({ source: explicit, children, ...props }: MapViewProps) {
  const { source, Backend } = useBackend(explicit);
  return (
    <SourceContext.Provider value={source}>
      <Backend.MapView {...props}>{children}</Backend.MapView>
    </SourceContext.Provider>
  );
}

export function Marker(props: MarkerProps) {
  const { Backend } = useBackend();
  return <Backend.Marker {...props} />;
}

export function Polyline(props: PolylineProps) {
  const { Backend } = useBackend();
  return <Backend.Polyline {...props} />;
}
