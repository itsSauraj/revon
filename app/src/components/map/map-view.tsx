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
import { useMapSource } from '@/lib/map-source';

import * as Google from './google-map';
import * as Osm from './osm-map';
import type { MapViewProps, MarkerProps, PolylineProps } from './types';

export type { Camera, EdgePadding, MapRef, MapViewProps, MarkerProps, PolylineProps, Region } from './types';

export function MapView(props: MapViewProps) {
  const Backend = useMapSource() === 'osm' ? Osm : Google;
  return <Backend.MapView {...props} />;
}

export function Marker(props: MarkerProps) {
  const Backend = useMapSource() === 'osm' ? Osm : Google;
  return <Backend.Marker {...props} />;
}

export function Polyline(props: PolylineProps) {
  const Backend = useMapSource() === 'osm' ? Osm : Google;
  return <Backend.Polyline {...props} />;
}
