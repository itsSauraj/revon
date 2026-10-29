/**
 * The map contract every backend implements (Google native, Google web, OpenStreetMap native,
 * OpenStreetMap web). Screens only ever import from `map-view.tsx`, which picks a backend from the
 * rider's map source setting, so they never need platform or provider checks.
 *
 * The shape mirrors the subset of react-native-maps the app uses, because that was the first
 * backend; coordinates are `{ latitude, longitude }` everywhere.
 */
import type { ReactNode, Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { MapSource } from '@/lib/map-source';
import type { LatLng } from '@/lib/types';

export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

export type EdgePadding = { top: number; right: number; bottom: number; left: number };

export type Camera = {
  center: LatLng;
  /** Degrees clockwise from north. */
  heading: number;
  /** Tilt in degrees, 0 = top-down. */
  pitch: number;
  /** Web Mercator zoom level. */
  zoom: number;
};

/** Imperative handle every backend exposes through `ref`. */
export type MapRef = {
  animateToRegion(region: Region, duration?: number): void;
  /** Animate any subset of the camera; unspecified fields keep their current value. */
  animateCamera(camera: Partial<Camera>, opts?: { duration?: number }): void;
  getCamera(): Promise<Camera>;
  fitToCoordinates(coordinates?: LatLng[], options?: { edgePadding?: EdgePadding; animated?: boolean }): void;
};

/** A GPS fix from the map's own location source. heading/speed are -1 when unknown. */
export type UserLocationEvent = { nativeEvent: { coordinate?: LatLng & { heading: number; speed: number } } };

export type MapPressEvent = { nativeEvent: { coordinate: LatLng } };

export type MapViewProps = {
  ref?: Ref<MapRef>;
  /**
   * Draw with this source instead of the rider's setting. The ride screen passes the source a ride
   * was created with, so Google content is only ever shown on a Google map (and OSM on OSM).
   */
  source?: MapSource;
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  /** Show the rider's position and report fixes through `onUserLocationChange`. */
  showsUserLocation?: boolean;
  /** Insets that shift the camera target and the backend's own UI (logo, attribution). */
  mapPadding?: EdgePadding;
  onUserLocationChange?: (e: UserLocationEvent) => void;
  /** Long press on native, right-click or long press on web. */
  onLongPress?: (e: MapPressEvent) => void;
  /** The user started dragging the map. */
  onPanDrag?: () => void;
  /** The camera settled after a pan, zoom, rotate or animation. */
  onRegionChangeComplete?: () => void;
  children?: ReactNode;
};

export type MarkerProps = {
  coordinate: LatLng;
  /** Title/description open in a small themed label when the marker is tapped. */
  title?: string;
  description?: string;
  /** Used only when no children are given (a plain pin). */
  pinColor?: string;
  /** Which point of the marker view sits on the coordinate: x and y as 0..1 fractions. Defaults to the centre. */
  anchor?: { x: number; y: number };
  zIndex?: number;
  onPress?: () => void;
  onCalloutPress?: () => void;
  children?: ReactNode;
  /** Native rendering hint: re-rasterise the marker view while it is changing. */
  tracksViewChanges?: boolean;
};

export type PolylineProps = {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  /** Stacking among polylines; markers always draw above lines. */
  zIndex?: number;
};

/** Zoom level that shows roughly `latitudeDelta` degrees of latitude in the viewport. */
export function zoomForDelta(latitudeDelta: number) {
  return Math.round(Math.max(2, Math.min(20, Math.log2(360 / Math.max(latitudeDelta, 1e-6)))));
}
