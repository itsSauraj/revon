/**
 * Routing for the current map source (lib/map-source.ts).
 *
 * - Google: Routes API (two-wheeler where available, else driving, traffic-aware).
 * - OpenStreetMap: Valhalla (motorcycle costing, honours avoid highways/tolls), OSRM as fallback.
 *
 * Both return the same Route shape: a Google-encoded polyline (precision 5) plus totals, and, with
 * steps, turn instructions whose `maneuver` uses the Google Routes names (see nav/maneuver.ts).
 */
import { Linking, Platform } from 'react-native';

import * as google from './google';
import { getMapSource, type MapSource } from './map-source';
import * as osm from './osm';
import type { Avoid, LatLng, Route, RouteWithSteps } from './types';

export const NO_AVOID: Avoid = { highways: false, tolls: false };

/** `source` defaults to the rider's setting; the ride screen passes the source its ride was created with. */
export function computeRoute(
  origin: LatLng,
  destination: LatLng,
  avoid?: Avoid,
  withSteps?: false,
  source?: MapSource,
): Promise<Route | null>;
export function computeRoute(
  origin: LatLng,
  destination: LatLng,
  avoid: Avoid | undefined,
  withSteps: true,
  source?: MapSource,
): Promise<RouteWithSteps | null>;
export function computeRoute(
  origin: LatLng,
  destination: LatLng,
  avoid: Avoid = NO_AVOID,
  withSteps = false,
  source: MapSource = getMapSource(),
): Promise<Route | RouteWithSteps | null> {
  const provider = source === 'osm' ? osm : google;
  return provider.computeRoute(origin, destination, avoid, withSteps);
}

/** Name of the app the "open externally" button hands over to, for button labels. */
export function externalNavName(source: MapSource = getMapSource()): string {
  if (source === 'google') return 'Google Maps';
  return Platform.OS === 'ios' ? 'Apple Maps' : Platform.OS === 'android' ? 'a maps app' : 'OpenStreetMap';
}

/**
 * Optional: hands spoken turn-by-turn to an installed maps app. Google Maps for the Google source.
 * For OpenStreetMap: the system picker on Android (geo: URI → OsmAnd, Organic Maps, Google Maps…),
 * Apple Maps on iOS, and OpenStreetMap directions in the browser on web.
 */
export async function openExternalNav(to: LatLng, label?: string, source: MapSource = getMapSource()) {
  if (source === 'google') return google.openGoogleMapsNav(to);
  const dest = `${to.latitude},${to.longitude}`;
  const url =
    Platform.OS === 'android'
      ? `geo:${dest}?q=${dest}${label ? `(${encodeURIComponent(label)})` : ''}`
      : Platform.OS === 'ios'
        ? `maps://?daddr=${dest}&dirflg=d`
        : `https://www.openstreetmap.org/directions?route=;${dest}`;
  try {
    await Linking.openURL(url);
  } catch {
    await google.openGoogleMapsNav(to);
  }
}
