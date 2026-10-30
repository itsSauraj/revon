/**
 * Place search for the current map source (lib/map-source.ts).
 *
 * - Google: Places API (New) autocomplete, then a details call for the coordinates; both share a
 *   session token so Google bills them as one search.
 * - OpenStreetMap: Photon (komoot) geocoder, which returns coordinates with each suggestion.
 */
import * as google from './google';
import { getMapSource, type MapSource } from './map-source';
import * as osm from './osm';
import type { LatLng, Place, Suggestion } from './types';

export { newSessionToken } from './google';

/** Suggestions for what the rider typed, biased toward their position. */
export function searchPlaces(
  input: string,
  near: LatLng | null,
  sessionToken: string,
  source: MapSource = getMapSource(),
): Promise<Suggestion[]> {
  return source === 'osm' ? osm.searchPlaces(input, near) : google.placesAutocomplete(input, near, sessionToken);
}

/** The chosen suggestion as a place with coordinates. */
export function resolvePlace(suggestion: Suggestion, sessionToken: string): Promise<Place> {
  // OpenStreetMap suggestions carry their place; only Google needs the details call.
  if (suggestion.place) return Promise.resolve(suggestion.place);
  return google.placeDetails(suggestion.id, sessionToken);
}
