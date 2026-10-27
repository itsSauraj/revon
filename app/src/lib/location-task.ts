/**
 * Location tracking for an active ride.
 *
 * The background task is the single writer of this rider's position, in both foreground and
 * background. It writes through the Realtime Database REST API rather than the JS SDK because the
 * SDK's WebSocket isn't reliably connected while the app is backgrounded (e.g. Google Maps is open
 * in front). This module must be imported at the top level of the app so the task is defined
 * before the OS delivers updates.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { getIdToken } from './auth';
import { DATABASE_URL } from './firebase';
import {
  ARRIVED_M,
  decodePolyline,
  haversine,
  OFF_ROUTE_GRACE_MS,
  OFF_ROUTE_M,
  projectOntoRoute,
} from './geo';
import type { LatLng, RideEventType } from './types';

export const LOCATION_TASK = 'revon-ride-location';
const CTX_KEY = 'revon.activeRide';
const ACTIVITY_EVERY_MS = 10 * 60 * 1000;

export type TrackingContext = {
  rideId: string;
  uid: string;
  polyline: string | null;
  destination: LatLng;
};

type RuntimeState = {
  ctx: TrackingContext;
  route: LatLng[];
  offSince: number | null;
  offRoute: boolean;
  arrived: boolean;
  lastActivityWrite: number;
};

let runtime: RuntimeState | null = null;
let watchSub: Location.LocationSubscription | null = null;

async function getRuntime(): Promise<RuntimeState | null> {
  if (runtime) return runtime;
  const raw = await AsyncStorage.getItem(CTX_KEY);
  if (!raw) return null;
  const ctx = JSON.parse(raw) as TrackingContext;
  runtime = {
    ctx,
    route: ctx.polyline ? decodePolyline(ctx.polyline) : [],
    offSince: null,
    offRoute: false,
    arrived: false,
    lastActivityWrite: 0,
  };
  return runtime;
}

async function rest(method: 'PUT' | 'PATCH' | 'POST', path: string, body: unknown) {
  const token = await getIdToken().catch(() => null);
  if (!token) return;
  await fetch(`${DATABASE_URL}/${path}.json?auth=${token}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SERVER_TS = { '.sv': 'timestamp' };

function postEventRest(ctx: TrackingContext, type: RideEventType) {
  return rest('POST', `rides/${ctx.rideId}/events`, { type, uid: ctx.uid, ts: SERVER_TS });
}

export async function handleLocation(loc: Location.LocationObject) {
  const rt = await getRuntime();
  if (!rt) return;
  const { ctx } = rt;
  const p = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  const now = loc.timestamp;

  const proj = rt.route.length > 1 ? projectOntoRoute(p, rt.route) : null;

  if (proj && !rt.arrived) {
    if (proj.crossM > OFF_ROUTE_M) {
      rt.offSince ??= now;
      if (!rt.offRoute && now - rt.offSince > OFF_ROUTE_GRACE_MS) {
        rt.offRoute = true;
        postEventRest(ctx, 'off_route').catch(() => {});
      }
    } else {
      rt.offSince = null;
      if (rt.offRoute) {
        rt.offRoute = false;
        postEventRest(ctx, 'back_on_route').catch(() => {});
      }
    }
  }

  const arrivedNow = !rt.arrived && haversine(p, ctx.destination) < ARRIVED_M;

  await rest('PUT', `rides/${ctx.rideId}/locations/${ctx.uid}`, {
    lat: p.latitude,
    lng: p.longitude,
    speed: loc.coords.speed ?? -1,
    heading: loc.coords.heading ?? 0,
    ts: SERVER_TS,
    alongM: proj ? Math.round(proj.alongM) : null,
    offRoute: rt.offRoute,
  }).catch(() => {});

  if (now - rt.lastActivityWrite > ACTIVITY_EVERY_MS) {
    rt.lastActivityWrite = now;
    rest('PUT', `rides/${ctx.rideId}/meta/lastActivityAt`, Date.now()).catch(() => {});
  }

  if (arrivedNow) {
    rt.arrived = true;
    await rest('PATCH', `rides/${ctx.rideId}/members/${ctx.uid}`, { status: 'arrived' }).catch(() => {});
    await postEventRest(ctx, 'arrived').catch(() => {});
    // The session ends for a rider once they arrive: stop tracking to save battery.
    await stopTracking({ keepContext: false });
  }
}

// Browsers have no background tasks; web uses the watchPositionAsync fallback in startTracking.
if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    // Only the most recent fix matters for a live position.
    await handleLocation(data.locations[data.locations.length - 1]);
  });
}

export type TrackingMode = 'background' | 'foreground-only' | 'denied';

export async function startTracking(ctx: TrackingContext): Promise<TrackingMode> {
  await stopTracking({ keepContext: false });
  await AsyncStorage.setItem(CTX_KEY, JSON.stringify(ctx));
  runtime = null;

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';

  // iOS: ask to upgrade to "Always". Not required — while-in-use plus the background indicator
  // keeps updates flowing. Android: the location foreground service covers backgrounding, and
  // asking for background permission there sends the user to Settings, so we skip it.
  if (Platform.OS === 'ios') await Location.requestBackgroundPermissionsAsync().catch(() => null);

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Group ride in progress',
        notificationBody: 'Revon is sharing your location with your ride group.',
        notificationColor: '#0A0A0A',
        killServiceOnDestroy: false,
      },
    });
    return 'background';
  } catch {
    // e.g. Expo Go, where background tasks aren't available.
    watchSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      (loc) => {
        handleLocation(loc).catch(() => {});
      },
    );
    return 'foreground-only';
  }
}

export async function stopTracking({ keepContext }: { keepContext: boolean }) {
  watchSub?.remove();
  watchSub = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // task was never registered
  }
  if (!keepContext) {
    runtime = null;
    await AsyncStorage.removeItem(CTX_KEY);
  }
}

export async function getActiveRideId(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(CTX_KEY);
  return raw ? (JSON.parse(raw) as TrackingContext).rideId : null;
}

export async function isTracking() {
  if (watchSub) return true;
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}
