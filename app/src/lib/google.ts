import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import type { LatLng, Place } from './types';

const API_KEY: string = Constants.expoConfig?.extra?.googleApiKey ?? '';

export type Suggestion = { placeId: string; main: string; secondary: string };

export type Route = { polyline: string; distanceM: number; durationS: number };

async function googlePost<T>(url: string, fieldMask: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function newSessionToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Places API (New) autocomplete, biased toward the rider's position. */
export async function placesAutocomplete(
  input: string,
  near: LatLng | null,
  sessionToken: string,
): Promise<Suggestion[]> {
  type Res = {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
        text?: { text: string };
      };
    }[];
  };
  const data = await googlePost<Res>(
    'https://places.googleapis.com/v1/places:autocomplete',
    'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text',
    {
      input,
      sessionToken,
      ...(near
        ? { locationBias: { circle: { center: near, radius: 50000 } } }
        : {}),
    },
  );
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }));
}

export async function placeDetails(placeId: string, sessionToken: string): Promise<Place> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?sessionToken=${encodeURIComponent(sessionToken)}`,
    {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'location,displayName,formattedAddress',
      },
    },
  );
  if (!res.ok) throw new Error(`Place details ${res.status}: ${await res.text()}`);
  const p = (await res.json()) as {
    location: LatLng;
    displayName?: { text: string };
    formattedAddress?: string;
  };
  return {
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    name: p.displayName?.text ?? p.formattedAddress ?? 'Destination',
    address: p.formattedAddress,
  };
}

/**
 * Routes API. Tries the two-wheeler mode first (only available in some countries) and falls back
 * to driving.
 */
export async function computeRoute(
  origin: LatLng,
  destination: LatLng,
  avoid: { highways: boolean; tolls: boolean } = { highways: false, tolls: false },
): Promise<Route | null> {
  type Res = {
    routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[];
  };
  const body = (travelMode: 'TWO_WHEELER' | 'DRIVE') => ({
    origin: { location: { latLng: origin } },
    destination: { location: { latLng: destination } },
    travelMode,
    routingPreference: 'TRAFFIC_AWARE',
    routeModifiers: { avoidHighways: avoid.highways, avoidTolls: avoid.tolls },
  });
  const mask = 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline';
  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  let data: Res | null = null;
  try {
    data = await googlePost<Res>(url, mask, body('TWO_WHEELER'));
  } catch {
    data = null;
  }
  if (!data?.routes?.length) data = await googlePost<Res>(url, mask, body('DRIVE'));

  const r = data.routes?.[0];
  if (!r?.polyline?.encodedPolyline) return null;
  return {
    polyline: r.polyline.encodedPolyline,
    distanceM: r.distanceMeters ?? 0,
    durationS: parseInt(r.duration ?? '0', 10),
  };
}

/**
 * Hands turn-by-turn navigation off to the Google Maps app (or the browser if it isn't installed).
 * On Android, mode "l" asks for two-wheeler directions where supported.
 */
export async function openGoogleMapsNav(to: LatLng) {
  const dest = `${to.latitude},${to.longitude}`;
  const candidates =
    Platform.OS === 'android'
      ? [`google.navigation:q=${dest}&mode=l`, `google.navigation:q=${dest}`]
      : [`comgooglemaps://?daddr=${dest}&directionsmode=driving`];
  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // try next
    }
  }
  await Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving&dir_action=navigate`,
  );
}
